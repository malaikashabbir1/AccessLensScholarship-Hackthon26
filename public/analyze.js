
"use strict";

const PROFILE_KEY = "accessLensStudentProfile";
const API_ENDPOINT = "/api/analyze-scholarship";

const form = document.getElementById("analyzeForm");
const scholarshipNameInput = document.getElementById("scholarshipName");
const scholarshipTextInput = document.getElementById("scholarshipText");
const scholarshipCount = document.getElementById("scholarshipCount");
const scholarshipError = document.getElementById("scholarshipError");
const profileSummary = document.getElementById("profileSummary");
const profileError = document.getElementById("profileError");
const analyzeButton = document.getElementById("analyzeButton");
const formStatus = document.getElementById("formStatus");
const resultsSection = document.getElementById("resultsSection");
const resultsTitle = document.getElementById("resultsTitle");
const resultIntro = document.getElementById("resultIntro");
const analysisResults = document.getElementById("analysisResults");
const analyzeAgainButton = document.getElementById("analyzeAgainButton");

let savedProfile = null;

// ---------- General helpers ----------

function getSavedProfile() {
  try {
    const profile = localStorage.getItem(PROFILE_KEY);
    return profile ? JSON.parse(profile) : null;
  } catch (error) {
    console.error("Could not read the saved student profile:", error);
    return null;
  }
}

function getFirstValue(object, keys, fallback = "") {
  for (const key of keys) {
    const value = object?.[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
}

function toText(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return "";
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n+/)
      .map((item) => item.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter(Boolean);
  }

  return [];
}

function showStatus(message, type = "info") {
  formStatus.textContent = message;
  formStatus.dataset.type = type;
}

function updateCharacterCount() {
  scholarshipCount.textContent =
    `${scholarshipTextInput.value.length.toLocaleString()} / 15,000`;
}

function updateProfileSummary() {
  savedProfile = getSavedProfile();

  if (!savedProfile || typeof savedProfile !== "object") {
    profileSummary.textContent = "No saved profile found. Complete your profile first.";
    profileError.hidden = false;
    analyzeButton.disabled = true;
    return;
  }

  const degree = getFirstValue(savedProfile, ["degreeTitle", "qualification"], "Degree not provided");
  const field = getFirstValue(savedProfile, ["major"], "Field not provided");
  const score = getFirstValue(savedProfile, ["academicScore"], "");
  const institution = getFirstValue(savedProfile, ["institution"], "");

  const details = [degree, field];

  if (score !== "") details.push(`Score: ${score}`);
  if (institution) details.push(institution);

  profileSummary.textContent = details.join(" · ");
  profileError.hidden = true;
  analyzeButton.disabled = false;
}

// ---------- Safe DOM helpers ----------

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }

  return element;
}

function createCardHeading(icon, title, subtitle) {
  const heading = createElement("div", "al-result-card-heading");
  heading.append(
    createElement("span", "al-result-card-icon", icon)
  );

  const textContainer = createElement("div");
  textContainer.append(createElement("h3", "", title));

  if (subtitle) {
    textContainer.append(createElement("p", "", subtitle));
  }

  heading.append(textContainer);
  return heading;
}

function createResultCard(icon, title, subtitle, tone = "neutral") {
  const card = createElement("section", "al-result-card");
  card.dataset.tone = tone;
  card.append(createCardHeading(icon, title, subtitle));
  return card;
}

// ---------- Parse AI response ----------

function parseAnalysisResponse(data) {
  let analysis =
    data?.analysis ??
    data?.result ??
    data?.response ??
    data?.output ??
    data;

  // Some APIs return JSON as a string.
  if (typeof analysis === "string") {
    const cleaned = analysis
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    try {
      analysis = JSON.parse(cleaned);
    } catch {
      // Preserve plain-text answers rather than crashing.
      analysis = { summary: cleaned };
    }
  }

  // Handle a nested JSON string in a common response shape.
  if (typeof analysis?.text === "string" && !analysis.eligibility) {
    const cleaned = analysis.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    try {
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { summary: analysis.text };
    }
  }

  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
    return {
      summary: toText(analysis) || "The AI returned an empty analysis."
    };
  }

  return analysis;
}

// ---------- Eligibility verdict ----------

function getVerdict(analysis) {
  const rawVerdict = toText(
    getFirstValue(analysis, [
      "eligibility",
      "eligibilityAssessment",
      "verdict",
      "overallEligibility",
      "eligibilityStatus"
    ])
  ).trim();

  const summary = toText(
    getFirstValue(analysis, ["summary", "explanation", "overallAssessment"])
  );

  const normalized = rawVerdict.toLowerCase();

  let title = rawVerdict || "Assessment completed";
  let tone = "neutral";

  if (
    /\b(not eligible|ineligible|does not qualify|do not qualify|doesn't qualify)\b/.test(normalized)
  ) {
    tone = "danger";
  } else if (
    /\b(potentially eligible|likely eligible|eligible|appears eligible|meets requirements)\b/.test(normalized)
  ) {
    tone = "success";
  } else if (
    /\b(partially eligible|partially meets|uncertain|cannot determine|unable to determine|insufficient information|needs verification|check required)\b/.test(normalized)
  ) {
    tone = "warning";
  } else if (!rawVerdict) {
    title = "Review the findings";
  }

  // Prefer a short verdict heading instead of displaying a paragraph as a badge.
  if (title.length > 90) {
    title = "Review the findings";
  }

  return {
    title,
    tone,
    explanation: summary || (
      "Review the criteria below. Any missing information or uncertain requirement should be verified with the scholarship provider."
    )
  };
}

function getToneLabel(tone) {
  const labels = {
    success: "Potential match",
    warning: "Needs verification",
    danger: "Potential barrier",
    neutral: "Review findings"
  };

  return labels[tone] || labels.neutral;
}

// ---------- Metrics ----------

function getCriteriaLists(analysis) {
  const met = normalizeList(
    getFirstValue(analysis, [
      "matchingRequirements",
      "criteriaMet",
      "metRequirements",
      "requirementsMet",
      "matchingCriteria"
    ], [])
  );

  const missing = normalizeList(
    getFirstValue(analysis, [
      "missingRequirements",
      "unmetRequirements",
      "gaps",
      "eligibilityGaps",
      "requirementsNotMet"
    ], [])
  );

  const verify = normalizeList(
    getFirstValue(analysis, [
      "requirementsToVerify",
      "unclearRequirements",
      "verificationNeeded",
      "uncertainRequirements",
      "requirementsNeedingVerification"
    ], [])
  );

  return { met, missing, verify };
}

function createMetricCard(icon, value, label, tone) {
  const card = createElement("div", "al-metric-card");
  card.dataset.tone = tone;

  card.append(createElement("span", "al-metric-icon", icon));
  card.append(createElement("span", "al-metric-value", value));
  card.append(createElement("span", "al-metric-label", label));

  return card;
}

function renderMetrics(analysis, lists) {
  const metrics = createElement("div", "al-metrics");

  metrics.append(
    createMetricCard("✓", lists.met.length, "Requirements matched", "success"),
    createMetricCard("?", lists.verify.length, "Need verification", "warning"),
    createMetricCard("!", lists.missing.length, "Potential gaps", "danger")
  );

  // Show a match score only if the AI actually returned one.
  const rawScore = getFirstValue(analysis, ["matchScore", "profileMatchScore"], null);

  if (
    rawScore !== null &&
    rawScore !== "" &&
    Number.isFinite(Number(rawScore)) &&
    Number(rawScore) >= 0 &&
    Number(rawScore) <= 100
  ) {
    const scoreCard = createMetricCard(
      "◎",
      `${Number(rawScore)}%`,
      "AI-estimated profile match",
      "neutral"
    );

    metrics.append(scoreCard);
  }

  return metrics;
}

// ---------- Requirement lists ----------

function normalizeCriterion(item, index) {
  if (typeof item === "string" || typeof item === "number") {
    return {
      title: `Requirement ${index + 1}`,
      description: String(item),
      status: ""
    };
  }

  if (!item || typeof item !== "object") {
    return {
      title: `Requirement ${index + 1}`,
      description: toText(item),
      status: ""
    };
  }

  return {
    title: toText(
      getFirstValue(item, ["requirement", "criterion", "title", "name"], `Requirement ${index + 1}`)
    ),
    description: toText(
      getFirstValue(item, ["explanation", "reason", "details", "description", "finding"], "")
    ),
    status: toText(getFirstValue(item, ["status", "result"], ""))
  };
}

function inferCriterionTone(status, defaultTone) {
  const value = status.toLowerCase();

  if (/\b(met|match|satisfied|pass|eligible|yes)\b/.test(value)) {
    return "success";
  }

  if (/\b(missing|unmet|fail|not met|ineligible|no)\b/.test(value)) {
    return "danger";
  }

  if (/\b(unclear|unknown|verify|pending|uncertain|partial)\b/.test(value)) {
    return "warning";
  }

  return defaultTone;
}

function createCriterionItem(item, index, defaultTone, defaultStatus) {
  const criterion = normalizeCriterion(item, index);
  const tone = inferCriterionTone(criterion.status, defaultTone);

  const symbols = {
    success: "✓",
    warning: "?",
    danger: "!",
    neutral: "•"
  };

  const itemElement = createElement("div", "al-criteria-item");
  itemElement.dataset.tone = tone;

  itemElement.append(
    createElement("span", "al-criteria-symbol", symbols[tone] || "•")
  );

  const body = createElement("div", "al-criteria-body");
  body.append(createElement("p", "al-criteria-title", criterion.title));

  if (criterion.description) {
    body.append(
      createElement("p", "al-criteria-description", criterion.description)
    );
  }

  itemElement.append(body);

  const statusLabel = criterion.status || defaultStatus;
  if (statusLabel) {
    const badge = createElement("span", "al-criteria-badge", statusLabel);
    badge.classList.add(tone);
    itemElement.append(badge);
  }

  return itemElement;
}

function renderCriteriaSection(title, subtitle, items, tone, icon, emptyMessage) {
  const card = createResultCard(icon, title, subtitle, tone);
  const list = createElement("div", "al-criteria-list");

  if (!items.length) {
    list.append(createElement("p", "al-empty-message", emptyMessage));
  } else {
    items.forEach((item, index) => {
      list.append(
        createCriterionItem(
          item,
          index,
          tone,
          tone === "success" ? "Met" :
            tone === "danger" ? "Potential gap" :
              "Verify"
        )
      );
    });
  }

  card.append(list);
  return card;
}

// ---------- Recommendations ----------

function renderRecommendations(analysis) {
  const recommendations = normalizeList(
    getFirstValue(analysis, [
      "recommendations",
      "nextSteps",
      "recommendedActions",
      "actionItems",
      "suggestions"
    ], [])
  );

  const card = createResultCard(
    "→",
    "Your recommended next steps",
    "Practical actions based on the assessment",
    "neutral"
  );

  const list = createElement("div", "al-recommendation-list");

  if (!recommendations.length) {
    list.append(
      createElement(
        "p",
        "al-empty-message",
        "Check the scholarship provider's official requirements and resolve any unclear criteria before applying."
      )
    );
  } else {
    recommendations.forEach((item, index) => {
      let text;

      if (typeof item === "string" || typeof item === "number") {
        text = String(item);
      } else {
        text = toText(
          getFirstValue(item, ["action", "recommendation", "title", "description", "text"], "")
        );
      }

      const row = createElement("div", "al-recommendation-item");
      row.append(createElement("span", "al-recommendation-number", index + 1));
      row.append(createElement("p", "", text));
      list.append(row);
    });
  }

  card.append(list);
  return card;
}

// ---------- Render full report ----------

function renderAnalysis(analysis, scholarshipName) {
  analysisResults.replaceChildren();

  const verdict = getVerdict(analysis);
  const lists = getCriteriaLists(analysis);

  resultsTitle.textContent = scholarshipName
    ? `Assessment: ${scholarshipName}`
    : "Scholarship assessment";

  resultIntro.textContent =
    "Compare the findings with your profile and verify any uncertain criteria with the official provider.";

  const hero = createElement("section", "al-result-hero");
  hero.dataset.tone = verdict.tone;

  const topLine = createElement("div", "al-result-topline");
  const titleBlock = createElement("div");

  titleBlock.append(
    createElement("p", "al-result-kicker", "Eligibility assessment"),
    createElement("h3", "", verdict.title)
  );

  topLine.append(titleBlock);

  const pill = createElement("span", "al-status-pill", getToneLabel(verdict.tone));
  pill.classList.add(verdict.tone);
  topLine.append(pill);

  hero.append(topLine);
  hero.append(createElement("p", "", verdict.explanation));
  analysisResults.append(hero);

  analysisResults.append(renderMetrics(analysis, lists));

  analysisResults.append(
    renderCriteriaSection(
      "Requirements matched",
      "Criteria that appear to align with your profile",
      lists.met,
      "success",
      "✓",
      "The AI did not identify confirmed matches. Review the scholarship criteria carefully."
    )
  );

  analysisResults.append(
    renderCriteriaSection(
      "Requirements to verify",
      "Information that is unclear or needs confirmation",
      lists.verify,
      "warning",
      "?",
      "No separate verification items were returned. This does not guarantee that every criterion has been verified."
    )
  );

  analysisResults.append(
    renderCriteriaSection(
      "Missing or unmet requirements",
      "Potential barriers identified by the analysis",
      lists.missing,
      "danger",
      "!",
      "No specific gaps were identified in the returned analysis. Confirm that the AI reviewed every official criterion."
    )
  );

  analysisResults.append(renderRecommendations(analysis));

  // Optional general explanation returned by the model.
  const details = toText(
    getFirstValue(analysis, ["detailedAnalysis", "reasoningSummary", "additionalNotes"], "")
  );

  if (details) {
    const detailsCard = createResultCard(
      "i",
      "Additional findings",
      "Further explanation from the analysis",
      "neutral"
    );

    detailsCard.append(createElement("p", "al-criteria-description", details));
    analysisResults.append(detailsCard);
  }

  resultsSection.hidden = false;
  resultsSection.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start"
  });
}

// ---------- Form submission ----------

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  updateProfileSummary();

  if (!savedProfile || typeof savedProfile !== "object") {
    showStatus("Please complete your student profile first.", "error");
    profileError.hidden = false;
    return;
  }

  const scholarshipText = scholarshipTextInput.value.trim();
  const scholarshipName = scholarshipNameInput.value.trim();

  scholarshipError.hidden = true;
  scholarshipError.textContent = "";

  if (scholarshipText.length < 50) {
    scholarshipError.textContent =
      "Please enter at least 50 characters of scholarship requirements.";
    scholarshipError.hidden = false;
    scholarshipTextInput.focus();
    return;
  }

  if (scholarshipText.length > 15000) {
    scholarshipError.textContent =
      "Scholarship requirements must not exceed 15,000 characters.";
    scholarshipError.hidden = false;
    scholarshipTextInput.focus();
    return;
  }

  analyzeButton.disabled = true;
  analyzeButton.innerHTML =
    '<span class="al-spinner" aria-hidden="true"></span> Analyzing scholarship...';

  showStatus("Comparing your profile with the scholarship criteria. This may take a moment.");
  resultsSection.hidden = true;

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        profile: savedProfile,
        degree: savedProfile.intendedDegree || savedProfile.degreeTitle || "",
        field: savedProfile.major || "",
        country: savedProfile.residenceCountry || "",

        englishTest: savedProfile.englishTest || "",
        englishScore: savedProfile.englishScore || "",

        scholarshipName,
        scholarshipText
      })
    });

   

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `The server returned an error (${response.status}).`
      );
    }

    const analysis = parseAnalysisResponse(data);

    // Keep the result on this page; no redirect to results.html.
    renderAnalysis(
      analysis,
      scholarshipName || "Scholarship analysis"
    );

    showStatus("Analysis completed. Review the findings below.", "success");
  } catch (error) {
    console.error("Scholarship analysis failed:", error);

    showStatus(
      error.message ||
      "Unable to analyze this scholarship. Please check your connection and try again.",
      "error"
    );
  } finally {
    analyzeButton.disabled = !getSavedProfile();
    analyzeButton.innerHTML =
      '<span aria-hidden="true">✦</span> Analyze my eligibility';
  }
});

// ---------- Page interactions ----------

scholarshipTextInput.addEventListener("input", updateCharacterCount);

analyzeAgainButton.addEventListener("click", () => {
  resultsSection.hidden = true;
  showStatus("You can edit the scholarship details and analyze again.");
  scholarshipTextInput.focus();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Initial page setup
updateCharacterCount();
updateProfileSummary();
