
import express from 'express';
import { GoogleGenAI } from '@google/genai';

const router = express.Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

router.post('/analyze-scholarship', async (req, res) => {
  try {
    const {
      profile = {},
      degree,
      field,
      country,
      scholarshipName,
      scholarshipText,
      englishTest,
      englishScore
    } = req.body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'GEMINI_API_KEY is missing. Check your .env file.'
      });
    }

    if (
      typeof scholarshipText !== 'string' ||
      !scholarshipText.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: 'Please enter scholarship information.'
      });
    }

    // Include the saved profile and support older field names.
    const studentProfile = {
      fullName: profile.fullName || '',
      nationality: profile.nationality || '',
      residenceCountry:
        profile.residenceCountry || country || '',
      dateOfBirth: profile.dateOfBirth || '',
      age: profile.age ?? '',
      qualification:
        profile.qualification || degree || '',
      degreeTitle:
        profile.degreeTitle || degree || '',
      major: profile.major || field || '',
      institution: profile.institution || '',
      gradingSystem: profile.gradingSystem || '',
      academicScore: profile.academicScore ?? '',
      graduationYear: profile.graduationYear || '',
      academicStatus: profile.academicStatus || '',
      intendedDegree: profile.intendedDegree || '',
      preferredIntake: profile.preferredIntake || '',
      preferredCountries: profile.preferredCountries || [],
      preferredFields: profile.preferredFields || [],
      fundingPreference: profile.fundingPreference || '',
      englishTest:
        profile.englishTest || englishTest || '',
      englishScore:
        profile.englishScore ?? englishScore ?? '',
      relevantExperience:
        profile.relevantExperience ?? '',
      additionalQualifications:
        profile.additionalQualifications || ''
    };

    const prompt = `
You are AccessLens, an AI scholarship eligibility comparison assistant.

SCHOLARSHIP NAME:
${scholarshipName || 'Not provided'}

STUDENT PROFILE:
${JSON.stringify(studentProfile, null, 2)}

SCHOLARSHIP DESCRIPTION:
${scholarshipText}

Compare every explicit scholarship requirement with the student's profile.

Return ONLY one valid JSON object. Do not use Markdown fences,
comments, or text before or after the JSON.

Use exactly this structure:
{
  "eligibility": "Preliminary assessment",
  "summary": "Brief personalized assessment",
  "scholarshipOverview": "Overview from the supplied description",
  "eligibilityCriteria": [
    {
      "requirement": "Specific criterion",
      "status": "met",
      "explanation": "Evidence-based comparison"
    }
  ],
  "matchingRequirements": [],
  "requirementsToVerify": [],
  "missingRequirements": [],
  "fundingAndBenefits": "Funding details or not specified",
  "requiredDocuments": [],
  "applicationDeadline": "Stated deadline or not specified",
  "detailedAnalysis": "Relevant limitations and findings",
  "recommendations": []
}

IMPORTANT RULES:
1. Use the actual profile values supplied above.
2. matchingRequirements, requirementsToVerify, and
   missingRequirements MUST be arrays of strings.
3. Add a match only when the profile supports it.
4. Add a missing requirement only when evidence shows it is unmet.
5. Put absent, unclear, or unconfirmed information under
   requirementsToVerify. Missing information is not automatic failure.
6. Compare CGPA only when the grading scales are comparable.
7. Compare English test results against stated requirements.
   If no score is provided, mark it for verification only when relevant.
8. Do not guess age, deadlines, eligibility rules, or funding amounts.
9. Do not claim the scholarship is genuine or officially verified.
10. Each eligibilityCriteria status must be exactly
    "met", "not_met", or "needs_verification".
11. Include every important eligibility criterion in the assessment.
12. Keep the verdict and summary concise and personalized.
`;

    console.log('Sending scholarship analysis request to Gemma 4...');

    // Keep the required Gemma 4 model.
    // Avoid forcing JSON response mode because it may not be
    // supported by every model/API configuration.
    const response = await ai.models.generateContent({
      model: 'models/gemma-4-26b-a4b-it',
      contents: prompt
    });

    const responseText = response.text?.trim();

    if (!responseText) {
      console.error('Gemma 4 returned an empty response.');
      return res.status(502).json({
        success: false,
        error:
          'Gemma 4 returned an empty response. Please try again.'
      });
    }

    // Handle JSON returned with optional Markdown fences.
    const cleanedText = responseText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let analysis;

    try {
      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Gemma 4 returned invalid JSON:', responseText);

      // Do not show a false report with zero requirements.
      return res.status(502).json({
        success: false,
        error:
          'Gemma 4 responded, but its report was not valid JSON. Please try again.'
      });
    }

    // Validate the essential fields used by the report UI.
    const requiredArrays = [
      'matchingRequirements',
      'requirementsToVerify',
      'missingRequirements'
    ];

    const invalidArrays = requiredArrays.filter(
      key => !Array.isArray(analysis[key])
    );

    if (invalidArrays.length > 0) {
      console.error(
        'Gemma 4 response is missing required arrays:',
        invalidArrays
      );

      return res.status(502).json({
        success: false,
        error:
          'Gemma 4 returned an incomplete report. Please try again.'
      });
    }

    return res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Scholarship analysis error:', error);

    // Return a useful message without exposing internal details.
    const message = String(error?.message || '');

    if (/429|RESOURCE_EXHAUSTED/i.test(message)) {
      return res.status(429).json({
        success: false,
        error:
          'Gemma 4 API quota or rate limit reached. Please try again later.'
      });
    }

    if (/API key|PERMISSION_DENIED|UNAUTHENTICATED|401|403/i.test(message)) {
      return res.status(502).json({
        success: false,
        error:
          'Gemma 4 API authentication or access failed. Check your API key and model access.'
      });
    }

    return res.status(502).json({
      success: false,
      error:
        'Gemma 4 could not complete the scholarship analysis. Check the server terminal for details and try again.'
    });
  }
});

export default router;
