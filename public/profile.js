document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "accessLensStudentProfile";

  const form = document.getElementById("studentProfileForm");
  const savedNotice = document.getElementById("savedNotice");
  const editButton = document.getElementById("editProfileButton");
  const clearButton = document.getElementById("clearProfileButton");
  const saveButton = document.getElementById("saveProfileButton");
  const continueCard = document.getElementById("continueCard");
  const message = document.getElementById("formMessage");

  const gradingSystem = document.getElementById("gradingSystem");
  const academicScore = document.getElementById("academicScore");
  const scoreHint = document.getElementById("scoreHint");

  const progressFill = document.getElementById("progressFill");
  const progressPercent = document.getElementById("progressPercent");
  const progressMessage = document.getElementById("progressMessage");
  const progressBar = document.getElementById("progressBar");

  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");

  if (!form) return;

  // Capture required fields before any read-only changes.
  const requiredFields = Array.from(
    form.querySelectorAll("[required]")
  );

  let isEditing = false;

  // -------------------------
  // MOBILE NAVIGATION
  // -------------------------

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");

      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.textContent = isOpen ? "✕" : "☰";
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "☰";
      });
    });
  }

  const yearElement = document.getElementById("currentYear");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // -------------------------
  // PROFILE STORAGE
  // -------------------------

  function loadProfile() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) return null;

      const profile = JSON.parse(saved);

      if (
        !profile ||
        typeof profile !== "object" ||
        Array.isArray(profile)
      ) {
        return null;
      }

      return profile;
    } catch (error) {
      console.error("Unable to load saved profile:", error);
      return null;
    }
  }

  function getFormData() {
    const profile = {};

    form.querySelectorAll("[name]").forEach((field) => {
      if (field instanceof HTMLSelectElement && field.multiple) {
        profile[field.name] = Array.from(field.selectedOptions)
          .map((option) => option.value);
      } else {
        profile[field.name] = field.value.trim();
      }
    });

    // Keep these fields optional.
    profile.englishTest = profile.englishTest || "";
    profile.englishScore = profile.englishScore || "";

    profile.updatedAt = new Date().toISOString();

    return profile;
  }

  function populateForm(profile) {
    Object.entries(profile).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);

      if (!field || key === "updatedAt") return;

      if (field instanceof HTMLSelectElement && field.multiple) {
        const selectedValues = Array.isArray(value) ? value : [];

        Array.from(field.options).forEach((option) => {
          option.selected = selectedValues.includes(option.value);
        });
      } else if (
        typeof value === "string" ||
        typeof value === "number"
      ) {
        field.value = String(value);
      }
    });

    // Support profiles saved before these fields were added.
    const englishTest = document.getElementById("englishTest");
    const englishScore = document.getElementById("englishScore");

    if (englishTest && !("englishTest" in profile)) {
      englishTest.value = "";
    }

    if (englishScore && !("englishScore" in profile)) {
      englishScore.value = "";
    }

    updateScoreHint();
    updateProgress();
  }

  function showMessage(text, type) {
    if (!message) return;

    message.textContent = text;
    message.className = `form-message ${type}`;
  }

  function clearMessage() {
    if (!message) return;

    message.textContent = "";
    message.className = "form-message";
  }

  function setReadOnlyMode(readOnly) {
    isEditing = !readOnly;

    form.querySelectorAll("input, select, textarea").forEach((field) => {
      field.disabled = readOnly;
    });

    if (saveButton) saveButton.hidden = readOnly;
    if (clearButton) clearButton.hidden = readOnly;

    if (editButton) {
      editButton.textContent = readOnly
        ? "Edit profile"
        : "Cancel editing";
    }

    // Restore required attributes when editing.
    requiredFields.forEach((field) => {
      if (readOnly) {
        field.removeAttribute("required");
      } else {
        field.setAttribute("required", "");
      }
    });
  }

  function showSavedProfile() {
    if (savedNotice) savedNotice.hidden = false;
    if (continueCard) continueCard.hidden = false;

    setReadOnlyMode(true);

    if (progressFill) progressFill.style.width = "100%";
    if (progressPercent) progressPercent.textContent = "100%";

    if (progressBar) {
      progressBar.setAttribute("aria-valuenow", "100");
    }

    if (progressMessage) {
      progressMessage.textContent = "Your profile has been saved.";
    }
  }

  function startEditing() {
    if (savedNotice) savedNotice.hidden = true;
    if (continueCard) continueCard.hidden = true;

    setReadOnlyMode(false);
    clearMessage();
    updateProgress();

    const fullName = document.getElementById("fullName");

    if (fullName) fullName.focus();

    form.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  // -------------------------
  // GRADING SYSTEM
  // -------------------------

  function updateScoreHint() {
    if (!gradingSystem || !academicScore || !scoreHint) return;

    const system = gradingSystem.value;

    const settings = {
      CGPA_4: {
        max: 4,
        step: "0.01",
        hint: "Enter a CGPA from 0 to 4.0."
      },
      CGPA_5: {
        max: 5,
        step: "0.01",
        hint: "Enter a CGPA from 0 to 5.0."
      },
      Percentage: {
        max: 100,
        step: "0.01",
        hint: "Enter a percentage from 0 to 100."
      },
      GPA_10: {
        max: 10,
        step: "0.01",
        hint: "Enter a GPA from 0 to 10."
      },
      Other: {
        max: null,
        step: "any",
        hint: "Enter your score using your institution's grading scale."
      }
    };

    const selected = settings[system];

    if (!selected) {
      academicScore.removeAttribute("max");
      academicScore.removeAttribute("step");
      scoreHint.textContent = "Choose your grading system first.";
      return;
    }

    academicScore.step = selected.step;

    if (selected.max !== null) {
      academicScore.max = String(selected.max);
    } else {
      academicScore.removeAttribute("max");
    }

    scoreHint.textContent = selected.hint;
  }

  if (gradingSystem) {
    gradingSystem.addEventListener("change", () => {
      updateScoreHint();
      updateProgress();
    });
  }

  // -------------------------
  // PROFILE COMPLETION
  // -------------------------

  function updateProgress() {
    if (!progressFill || !progressPercent || !progressBar ||
        !progressMessage) {
      return;
    }

    const completed = requiredFields.filter((field) => {
      if (field.disabled) return true;

      if (field instanceof HTMLSelectElement && field.multiple) {
        return field.selectedOptions.length > 0;
      }

      return field.value.trim() !== "";
    }).length;

    const total = requiredFields.length;

    const percentage = total
      ? Math.round((completed / total) * 100)
      : 0;

    progressFill.style.width = `${percentage}%`;
    progressPercent.textContent = `${percentage}%`;

    progressBar.setAttribute(
      "aria-valuenow",
      String(percentage)
    );

    progressMessage.textContent =
      percentage === 100
        ? "All required fields are completed."
        : `${completed} of ${total} required fields completed.`;
  }

  form.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("input", updateProgress);
    field.addEventListener("change", updateProgress);
  });

  // -------------------------
  // VALIDATION
  // -------------------------

  function validateProfile() {
    // Validate only the actual required profile fields.
    if (!form.reportValidity()) {
      return false;
    }

    // Explicitly reject an empty academic score.
    // Number("") incorrectly evaluates to zero.
    const scoreValue = academicScore.value.trim();

    if (scoreValue === "") {
      showMessage(
        "Please enter your academic score.",
        "error"
      );

      academicScore.focus();
      return false;
    }

    const score = Number(scoreValue);
    const system = gradingSystem.value;

    const maxScores = {
      CGPA_4: 4,
      CGPA_5: 5,
      Percentage: 100,
      GPA_10: 10
    };

    if (
      !Number.isFinite(score) ||
      score < 0 ||
      (
        maxScores[system] !== undefined &&
        score > maxScores[system]
      )
    ) {
      showMessage(
        "Please enter an academic score within your selected grading scale.",
        "error"
      );

      academicScore.focus();
      return false;
    }

    // Validate date of birth if supplied.
    const birthDateField = document.getElementById("dateOfBirth");
    const birthDate = birthDateField ? birthDateField.value : "";

    if (birthDate) {
      const parsedDate = new Date(`${birthDate}T00:00:00`);

      if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate > new Date()
      ) {
        showMessage(
          "Please enter a valid date of birth that is not in the future.",
          "error"
        );

        birthDateField.focus();
        return false;
      }
    }

    // Validate graduation year if supplied.
    const graduationYear = document.getElementById("graduationYear");

    if (
      graduationYear &&
      graduationYear.value &&
      Number(graduationYear.value) > new Date().getFullYear() + 10
    ) {
      showMessage(
        "Please check your graduation year.",
        "error"
      );

      graduationYear.focus();
      return false;
    }

    // English test and score are intentionally optional.
    // Do not reject the profile if either field is empty.

    return true;
  }

  // -------------------------
  // SAVE PROFILE
  // -------------------------

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearMessage();

    if (!validateProfile()) return;

    const profile = getFormData();

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(profile)
      );

      populateForm(profile);
      showSavedProfile();

      showMessage(
        "Your student profile has been saved successfully.",
        "success"
      );

      if (continueCard) {
        continueCard.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }
    } catch (error) {
      console.error("Unable to save profile:", error);

      showMessage(
        "Your profile could not be saved in this browser. Check your browser storage settings and try again.",
        "error"
      );
    }
  });

  // -------------------------
  // EDIT / CANCEL EDITING
  // -------------------------

  if (editButton) {
    editButton.addEventListener("click", () => {
      if (!isEditing) {
        startEditing();
        return;
      }

      // Cancel editing and restore the saved version.
      const savedProfile = loadProfile();

      if (savedProfile) {
        populateForm(savedProfile);

        if (savedNotice) savedNotice.hidden = false;
        if (continueCard) continueCard.hidden = false;

        setReadOnlyMode(true);
        clearMessage();
        updateProgress();
      }
    });
  }

  // -------------------------
  // CLEAR PROFILE
  // -------------------------

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      const confirmed = window.confirm(
        "Are you sure you want to delete your saved student profile from this browser?"
      );

      if (!confirmed) return;

      try {
        localStorage.removeItem(STORAGE_KEY);
        form.reset();

        if (savedNotice) savedNotice.hidden = true;
        if (continueCard) continueCard.hidden = true;

        setReadOnlyMode(false);
        clearMessage();
        updateScoreHint();
        updateProgress();

        showMessage(
          "Your saved profile has been cleared. You can create a new one.",
          "success"
        );

        const fullName = document.getElementById("fullName");

        if (fullName) fullName.focus();
      } catch (error) {
        console.error("Unable to clear profile:", error);

        showMessage(
          "Unable to clear the saved profile. Please check browser storage settings.",
          "error"
        );
      }
    });
  }

  // -------------------------
  // INITIALIZE PAGE
  // -------------------------

  updateScoreHint();

  const existingProfile = loadProfile();

  if (existingProfile) {
    populateForm(existingProfile);
    showSavedProfile();
  } else {
    updateProgress();
  }
});