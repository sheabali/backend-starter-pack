import Groq from "groq-sdk";
import config from "../config";

const groq = new Groq({
  apiKey: config.groq.api_key,
});

// ============================================
// TYPES & INTERFACES
// ============================================

export interface AnalysisResult {
  atsScore: number;
  formattingScore: number;
  keywordScore: number;
  foundKeywords: string[];
  missingKeywords: string[];
  keywordFrequency: Record<string, number>;
  jobMatchPercentage?: number;
  suggestions: {
    title: string;
    description: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    category:
    | "KEYWORDS"
    | "FORMATTING"
    | "STRUCTURE"
    | "CONTENT"
    | "ATS_COMPATIBILITY";
  }[];
}

// ============================================
// PROMPTS
// ============================================

const ATS_ANALYSIS_PROMPT = `You are an expert ATS (Applicant Tracking System) consultant with 10+ years of experience.

TASK: Analyze this resume and return ONLY a valid JSON object (no markdown, no code blocks, no explanations).

SCORING CRITERIA:
- ATS Score (0-100): Overall likelihood of passing ATS systems (formatting + keywords combined)
  * 90-100: Excellent - will pass most ATS
  * 70-89: Good - likely to pass
  * 50-69: Fair - may be filtered
  * 0-49: Poor - high filtering risk

- Formatting Score (0-100): How well structured for ATS parsers
  * Check: sections, consistent formatting, no tables/images, proper spacing
  
- Keyword Score (0-100): Keyword relevance and coverage
  * Consider: keyword frequency, placement, relevance to role

RESPONSE REQUIREMENTS:
- foundKeywords: All technical terms EXPLICITLY mentioned (minimum 10+)
- missingKeywords: Common keywords NOT found (based on inferred role, maximum 8)
- keywordFrequency: { "keyword": count } for all found keywords
- suggestions: 4-5 specific, actionable tips (prioritize HIGH before MEDIUM)

RETURN THIS JSON ONLY:
{
  "atsScore": <0-100>,
  "formattingScore": <0-100>,
  "keywordScore": <0-100>,
  "foundKeywords": ["keyword1", "keyword2"],
  "missingKeywords": ["keyword3", "keyword4"],
  "keywordFrequency": {"keyword1": 5, "keyword2": 3},
  "suggestions": [
    {
      "title": "Action title",
      "description": "Specific actionable advice with example",
      "priority": "HIGH|MEDIUM|LOW",
      "category": "KEYWORDS|FORMATTING|STRUCTURE|CONTENT|ATS_COMPATIBILITY"
    }
  ]
}`;

const JOB_MATCH_PROMPT = `You are an expert recruiter analyzing resume-to-job fit.

TASK: Compare this resume against the job description and:
1. Calculate job match percentage (0-100) based on keyword overlap and requirement satisfaction
2. Identify specific gaps between resume and job requirements
3. Suggest improvements to align resume with this specific job

Return ONLY JSON:
{
  "jobMatchPercentage": <0-100>,
  "matchAnalysis": "2-3 sentence summary of fit",
  "gaps": ["gap1", "gap2"],
  "alignmentSuggestions": [
    {
      "requirement": "Job requirement text",
      "resumeMatch": "What resume currently says",
      "suggestion": "How to improve match"
    }
  ]
}`;

const COVER_LETTER_PROMPT = `You are an expert cover letter writer. Generate a professional cover letter based on the provided resume and job details.

REQUIREMENTS:
- Tone: [TONE]
- Length: [LENGTH] words (±10% acceptable)
- Structure: Opening hook → 2-3 key achievements → job-specific relevance → strong closing

Return ONLY the cover letter text (no formatting, no markdown, no explanations). Write it as if the candidate will add their own name and personal details.`;

// ============================================
// HELPER FUNCTIONS
// ============================================

const clampScore = (n: number | undefined): number => {
  if (!n && n !== 0) return 50; // Default to 50 if undefined
  return Math.max(0, Math.min(100, Math.round(n)));
};

const validateSuggestion = (s: any) => ({
  title: s?.title || "Untitled Suggestion",
  description: s?.description || "No description provided",
  priority: ["HIGH", "MEDIUM", "LOW"].includes(s?.priority)
    ? s.priority
    : "MEDIUM",
  category: [
    "KEYWORDS",
    "FORMATTING",
    "STRUCTURE",
    "CONTENT",
    "ATS_COMPATIBILITY",
  ].includes(s?.category)
    ? s.category
    : "ATS_COMPATIBILITY",
});

const extractJsonFromResponse = (text: string): any => {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {
    // If that fails, try to extract JSON from text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error("Could not extract valid JSON from response");
      }
    }
    throw new Error("No JSON found in response");
  }
};

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

const analyzeResume = async (
  resumeText: string,
  jobDescription?: string
): Promise<AnalysisResult> => {
  if (!resumeText || resumeText.trim().length === 0) {
    return getErrorResponse("Resume text is empty or invalid");
  }

  try {
    // Step 1: Perform ATS analysis
    const atsResponse = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `${ATS_ANALYSIS_PROMPT}\n\nRESUME TO ANALYZE:\n---\n${resumeText}\n---`,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3, // Lower temperature for more consistent JSON
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const atsResponseText = atsResponse.choices[0]?.message?.content || "{}";
    const atsParsed = extractJsonFromResponse(atsResponseText);

    // Build result from ATS analysis
    const result: AnalysisResult = {
      atsScore: clampScore(atsParsed.atsScore),
      formattingScore: clampScore(atsParsed.formattingScore),
      keywordScore: clampScore(atsParsed.keywordScore),
      foundKeywords: Array.isArray(atsParsed.foundKeywords)
        ? atsParsed.foundKeywords.map((k: any) =>
          typeof k === "string" ? k.toLowerCase().trim() : ""
        )
        : [],
      missingKeywords: Array.isArray(atsParsed.missingKeywords)
        ? atsParsed.missingKeywords.map((k: any) =>
          typeof k === "string" ? k.toLowerCase().trim() : ""
        )
        : [],
      keywordFrequency: typeof atsParsed.keywordFrequency === "object"
        ? atsParsed.keywordFrequency
        : {},
      suggestions: Array.isArray(atsParsed.suggestions)
        ? atsParsed.suggestions
          .map(validateSuggestion)
          .sort((a: any, b: any) => {
            const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
            return (
              (priorityOrder[a.priority as keyof typeof priorityOrder] || 0) -
              (priorityOrder[b.priority as keyof typeof priorityOrder] || 0)
            );
          })
          .slice(0, 5) // Max 5 suggestions
        : [],
    };

    // Step 2: If job description provided, calculate job match
    if (jobDescription && jobDescription.trim().length > 0) {
      result.jobMatchPercentage = await calculateJobMatch(
        resumeText,
        jobDescription,
        result.foundKeywords
      );
    }

    // Step 3: Log metrics for analytics
    logAnalysisMetrics(result);

    return result;
  } catch (error) {
    console.error("Error in analyzeResume:", error);
    return getErrorResponse(
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};

// ============================================
// JOB MATCH CALCULATION
// ============================================

const calculateJobMatch = async (
  resumeText: string,
  jobDescription: string,
  resumeKeywords: string[]
): Promise<number> => {
  try {
    const matchResponse = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `${JOB_MATCH_PROMPT}\n\nRESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const matchResponseText = matchResponse.choices[0]?.message?.content || "{}";
    const matchParsed = extractJsonFromResponse(matchResponseText);

    return clampScore(matchParsed.jobMatchPercentage);
  } catch (error) {
    console.warn("Job match calculation failed:", error);
    // Fallback: Simple keyword overlap calculation
    const jdKeywords = jobDescription
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3);
    const matches = resumeKeywords.filter((k) =>
      jdKeywords.some((jd) => jd.includes(k) || k.includes(jd))
    );
    return Math.round((matches.length / jdKeywords.length) * 100);
  }
};

// ============================================
// COVER LETTER GENERATION
// ============================================

interface CoverLetterOptions {
  resumeText: string;
  jobDescription: string;
  jobTitle?: string;
  companyName?: string;
  tone?: "PROFESSIONAL" | "CONFIDENT" | "FRIENDLY" | "CREATIVE";
  length?: "SHORT" | "MEDIUM" | "LONG";
}

const generateCoverLetter = async (
  options: CoverLetterOptions
): Promise<string> => {
  const {
    resumeText,
    jobDescription,
    jobTitle = "Not specified",
    companyName = "the company",
    tone = "PROFESSIONAL",
    length = "MEDIUM",
  } = options;

  const lengthMap = {
    SHORT: 150,
    MEDIUM: 250,
    LONG: 400,
  };

  const targetLength = lengthMap[length];

  try {
    const prompt = COVER_LETTER_PROMPT.replace("[TONE]", tone)
      .replace("[LENGTH]", targetLength.toString());

    const clResponse = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nRESUME:\n${resumeText}\n\nJOB TITLE: ${jobTitle}\nCOMPANY: ${companyName}\nJOB DESCRIPTION:\n${jobDescription}`,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7, // Higher for creativity
      max_tokens: 1200,
    });

    const coverLetter =
      clResponse.choices[0]?.message?.content || "Unable to generate cover letter";

    // Clean up markdown if present
    return coverLetter
      .replace(/```markdown\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
  } catch (error) {
    console.error("Error generating cover letter:", error);
    throw new Error(
      `Failed to generate cover letter: ${error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

// ============================================
// ERROR HANDLING
// ============================================

const getErrorResponse = (errorMessage: string): AnalysisResult => {
  console.error("Analysis failed:", errorMessage);
  return {
    atsScore: 0,
    formattingScore: 0,
    keywordScore: 0,
    foundKeywords: [],
    missingKeywords: [],
    keywordFrequency: {},
    suggestions: [
      {
        title: "Analysis Failed",
        description: `Unable to analyze resume: ${errorMessage}. Please ensure the resume text is readable and try again.`,
        priority: "HIGH",
        category: "ATS_COMPATIBILITY",
      },
    ],
  };
};

// ============================================
// ANALYTICS / LOGGING
// ============================================

const logAnalysisMetrics = (result: AnalysisResult): void => {
  const metrics = {
    timestamp: new Date().toISOString(),
    atsScore: result.atsScore,
    formattingScore: result.formattingScore,
    keywordScore: result.keywordScore,
    foundKeywordsCount: result.foundKeywords.length,
    missingKeywordsCount: result.missingKeywords.length,
    suggestionsCount: result.suggestions.length,
    jobMatchPercentage: result.jobMatchPercentage || null,
  };

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log("Analysis metrics:", metrics);
  }

  // TODO: Send to analytics service (Mixpanel, Segment, etc.)
};

// ============================================
// MAIN EXPORT
// ============================================

export const AIService = {
  analyzeResume,
  generateCoverLetter,
  calculateJobMatch,
};