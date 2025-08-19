// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

//CHANGELOG 2025-08-15 by 邱语堂:直接新增了单选/判断题型的定义，兼容新题型。具体改动：第46-66，114-137，161，212-234行

import { AssessmentTemplate } from '../models/assessmentTemplate';
import { AssessType, MultiChoice, FreeText, TrueFalse , SingleChoice} from '../../../../../ui/src/graphql/API';
import { ReferenceDocuments } from '../models/referenceDocuments';

export function getInitialQuestionsPrompt(assessmentTemplate: AssessmentTemplate, topicsExtractionOutput: string, customPrompt?: string) {
  // TODO add topic to response for each question
  let prompt = `
You are creating a ${assessmentTemplate.assessType} questionnaire with exactly ${
    assessmentTemplate.totalQuestions
  } questions for a university student. The questions should be based STRICTLY on the academic content provided in the Summarised Transcript below.

IMPORTANT INSTRUCTIONS:
- Generate ONLY ${assessmentTemplate.totalQuestions} questions
- Base ALL questions on the academic content in the Provided Summarised Transcript
- Do NOT create questions about file formats, XML structures, or technical document formats
- Focus on the EDUCATIONAL CONTENT and subject matter from the transcript
- The response format will be XML, but the question content should be about the academic subject, NOT about XML
- The quiz should be clear, academic, and directly related to the learning material
- Do not reference the transcript itself, focus on the knowledge it contains
- Create ${assessmentTemplate.easyQuestions} easy, ${assessmentTemplate.mediumQuestions} medium, and ${assessmentTemplate.hardQuestions} hard questions
- Use language code: ${assessmentTemplate.docLang}

${customPrompt ? `
CUSTOM REQUIREMENTS (HIGHEST PRIORITY - MUST FOLLOW):
${customPrompt}

The above custom requirements should take precedence over standard instructions while still maintaining the XML response format and question count.
` : ''}

Use the Bloom's Taxonomy of category ${
    assessmentTemplate.taxonomy
  } to generate the questionaire and make sure the questions generated satisfy the description of the category ${
    assessmentTemplate.taxonomy
  } in the Bloom's Taxonomy.

The text below is a summarised transcript of the lecture that the teacher provided today

${
  assessmentTemplate.assessType === AssessType.multiChoiceAssessment
    ? `
  The questions are muliple choice questions.
  The answer choices must be around the topics covered in the lecture.
  Ensure that only one answer is correct.
  Indicate the correct answer labeled as 'answer'.
  Articulate a reasoned and concise defense for your chosen answer without relying on direct references to the text labeled as "explanation"
`
    : ''
}

${
  assessmentTemplate.assessType === AssessType.freeTextAssessment
    ? `
  The questions are free text questions. for every question create a rubric weight grading guidance in a <rubric> tag. In <rubric> there should be a list (minimum 2) of expected points to be covered in the answer and the weight associated with this point, only use single digit integer values for weights.
`
    : ''
}

${
  assessmentTemplate.assessType === AssessType.trueFalseAssessment
    ? `
  The questions are true/false questions. Provide two options: True and False, and indicate the correct answer.
  Articulate a reasoned and concise defense for your chosen answer without relying on direct references to the text labeled as "explanation" .
`
    : ''
}

${
  assessmentTemplate.assessType === AssessType.singleChoiceAssessment
    ? `  
  The questions are single choice questions. Provide four options, and indicate the correct answer.
  The answer choices must be around the topics covered in the lecture.
  Ensure that only one answer is correct.
  Articulate a reasoned and concise defense for your chosen answer without relying on direct references
  to the text labeled as "explanation".
`
    : ''
} 

The question must be focused the topics covered in the lecture and not on general topics around the subject.
Test the examinee's understanding of essential concepts mentioned in the transcript.
Follow these guidelines:

Formulate a question that probes knowledge of the Core Concepts.

RESPONSE FORMAT INSTRUCTIONS:
Your response should be formatted as XML data structure (this is just the format, NOT the content topic).
The actual question content should be about the academic subject matter from the transcript.
Do not include any additional text outside the XML structure.

Use this exact XML format for your response:
\`\`\`xml
<response>
    <questions>
        <title>[Brief question title about the academic topic]</title>
        <question>[Question about the subject matter from the transcript]</question>
    ${
      assessmentTemplate.assessType === AssessType.multiChoiceAssessment
        ? `
            <answerChoices>[Option 1]</answerChoices>
            <answerChoices>[Option 2]</answerChoices>
            <answerChoices>[Option 3]</answerChoices>
            <answerChoices>[Option 4]</answerChoices>
            <correctAnswer>[Correct Answer Number]</correctAnswer>
            <explanation>[Explanation for Correctness]</explanation>
    `
        : ''
    }
    ${
      assessmentTemplate.assessType === AssessType.freeTextAssessment
        ? `
          <rubric>
            <weight>[weight_value]</weight>
            <point>[Point 1]</point>
          </rubric>
          <rubric>
            <weight>[weight_value]</weight>
            <point>[Point 2]</point>
          </rubric>
          <!-- all other rubric points below   -->
    `
        : ''
    }
    </questions>
    <questions>
        <title>[Brief question title for question 2]</title>
        <question>[Question 2]</question>
    ${
      assessmentTemplate.assessType === AssessType.multiChoiceAssessment
        ? `
            <answerChoices>[Option 1]</answerChoices>
            <answerChoices>[Option 2]</answerChoices>
            <answerChoices>[Option 3]</answerChoices>
            <answerChoices>[Option 4]</answerChoices>
            <correctAnswer>[Correct Answer Number]</correctAnswer>
            <explanation>[Explanation for Correctness]</explanation>
    `
        : ''
    }
    ${
      assessmentTemplate.assessType === AssessType.freeTextAssessment
        ? `
          <rubric>
            <weight>[weight_value]</weight>
            <point>[Point 1]</point>
          </rubric>
          <rubric>
            <weight>[weight_value]</weight>
            <point>[Point 2]</point>
          </rubric>
          <!-- all other rubric points below   -->
    `
        : ''
    }
    </questions>
    <!-- repeat questions structure for each additional question -->
    ${
  assessmentTemplate.assessType === AssessType.trueFalseAssessment
    ? `
            <answerChoices>True</answerChoices>
            <answerChoices>False</answerChoices>
            <correctAnswer>[True/False]</correctAnswer>
            <explanation>[Explanation for Correctness]</explanation>
    `
    : ''
    }
    ${
      assessmentTemplate.assessType === AssessType.singleChoiceAssessment
        ? `
                <answerChoices>[Option 1]</answerChoices>
                <answerChoices>[Option 2]</answerChoices>
                <answerChoices>[Option 3]</answerChoices>
                <answerChoices>[Option 4]</answerChoices>
                <correctAnswer>[Correct Answer Number]</correctAnswer>
                <explanation>[Explanation for Correctness]</explanation>
        `
        : ''
    }
  
    
</response>
\`\`\`
    `;

  prompt += `Provided Summarised Transcript: \n ${
    topicsExtractionOutput.length > 50000 
      ? topicsExtractionOutput.substring(0, 50000) + '\n[Content truncated due to length limit]'
      : topicsExtractionOutput
  }`;
  return prompt;
}

export function getTopicsPrompt(referenceDocuments: ReferenceDocuments, customPrompt?: string) {
  // 如果有自定义prompt，优先使用自定义prompt作为主题提取
  if (customPrompt && customPrompt.trim()) {
    let prompt = `
TASK: Use the provided custom prompt as the primary learning topics and concepts for assessment generation.

CUSTOM LEARNING OBJECTIVES/TOPICS:
${customPrompt}

INSTRUCTIONS:
- The above custom prompt contains the specific learning objectives and topics that should be assessed
- Focus on these provided topics and concepts for question generation
- Extract and organize these topics in a clear, structured format
- If additional context is provided in documents below, use it to enhance understanding but prioritize the custom prompt
    `;
    
    // 如果还有文档内容，将其作为补充context添加（可选）
    if (referenceDocuments.documentsContent && referenceDocuments.documentsContent.length > 0) {
      prompt += `\n\nADDITIONAL CONTEXT FROM DOCUMENTS (use as supplementary information):\n`;
      
      const MAX_CONTENT_LENGTH = 200000; // 减少文档内容长度，因为主要依赖自定义prompt
      let totalContentLength = 0;
      
      for (let i = 0; i < referenceDocuments.documentsContent.length && totalContentLength < MAX_CONTENT_LENGTH; i++) {
        const document = referenceDocuments.documentsContent[i];
        const documentContent = document.length + totalContentLength > MAX_CONTENT_LENGTH 
          ? document.substring(0, MAX_CONTENT_LENGTH - totalContentLength)
          : document;
        
        if (documentContent.length === 0) {
          break;
        }
        
        prompt += `Document ${i}:\n`;
        prompt += documentContent;
        if (documentContent.length < document.length) {
          prompt += '\n[Content truncated due to length limit]';
        }
        prompt += '\n\n';
        
        totalContentLength += documentContent.length;
      }
    }
    
    return prompt;
  }
  
  // 如果没有自定义prompt，使用原有的文档提取逻辑
  let prompt = `
TASK: Extract key academic topics and learning concepts from educational content.

IMPORTANT INSTRUCTIONS:
- Focus ONLY on educational/academic content and subject matter
- IGNORE any technical file formats, document metadata, or system files  
- Extract topics related to the actual course material and learning objectives
- Do NOT include topics about document structure, file formats, XML, or technical specifications
- For each topic, provide a brief description of the educational concept covered
- Focus on knowledge that students should learn, not on document processing or technical formats

EXAMPLE of what to AVOID: "XML file structure", "document formatting", "file types"
EXAMPLE of what to INCLUDE: subject-specific concepts, theories, methodologies, skills

Please analyze the following educational documents and extract the academic topics:
    `;

  // Nova Lite has ~128K token limit, roughly 4 chars per token
  // Reserve 1000 tokens for prompt and response, so limit document content to ~100K tokens (~400K chars)
  const MAX_CONTENT_LENGTH = 400000;
  let totalContentLength = 0;

  for (let i = 0; i < referenceDocuments.documentsContent.length; i++) {
    const document = referenceDocuments.documentsContent[i];
    const documentContent = document.length + totalContentLength > MAX_CONTENT_LENGTH 
      ? document.substring(0, MAX_CONTENT_LENGTH - totalContentLength)
      : document;
    
    if (documentContent.length === 0) {
      break; // Skip if no room for more content
    }
    
    prompt += `Document ${i}:\n`;
    prompt += documentContent;
    if (documentContent.length < document.length) {
      prompt += '\n[Content truncated due to length limit]';
    }
    prompt += '\n\n';
    
    totalContentLength += documentContent.length;
    
    if (totalContentLength >= MAX_CONTENT_LENGTH) {
      break; // Stop adding more documents
    }
  }
  
  return prompt;
}

export function getRelevantDocumentsPrompt(question: MultiChoice | FreeText | TrueFalse | SingleChoice) {     //CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断兼容
  const kbQuery = `Find the relevant documents for the following quiz question:\n${JSON.stringify(question)}`;
  return kbQuery;
}

export function improveQuestionPrompt(xmlQuestion: any, xmlDocs: any, assessmentTemplate: AssessmentTemplate) {
  let prompt = `
TASK: Improve the academic question using the provided extracted documents if relevant.
Focus on enhancing the educational content, not the format.

If relevant, use the content in the EXTRACTED_DOCUMENTS to improve the QUESTION's academic accuracy and depth.
Any reference to the EXTRACTED_DOCUMENTS should include the uri of the document.

CURRENT QUESTION:
${xmlQuestion}

EXTRACTED_DOCUMENTS:
${xmlDocs}

RESPONSE FORMAT INSTRUCTIONS:
Format your response as XML data structure (this is just the format requirement, NOT the content topic).
The question content should be about the academic subject matter, not about XML or document formats.

Use this exact XML format:
\`\`\`xml
<question>
    <title>[Brief question title]</title>
    <question>
        [Question]
    </question>
    ${
      assessmentTemplate.assessType === AssessType.multiChoiceAssessment
        ? `
        <!-- for multiple choice questions only -->
            <answerChoices>[Option 1]</answerChoices>
            <answerChoices>[Option 2]</answerChoices>
            <answerChoices>[Option 3]</answerChoices>
            <answerChoices>[Option 4]</answerChoices>
            <correctAnswer>[Correct Answer Number]</correctAnswer>
        <!-- for multiple choice questions only -->
        <explanation>[Explanation for Correctness]</explanation>
    `
        : ''
    }
    ${
      assessmentTemplate.assessType === AssessType.freeTextAssessment
        ? `
          <rubric>
            <weight>[weight_value]</weight>
            <point>[Point 1]</point>
          </rubric>
          <rubric>
            <weight>[weight_value]</weight>
            <point>[Point 2]</point>
          </rubric>
          <!-- all other rubric points below   -->
    `
        : ''
    }
    ${
      assessmentTemplate.assessType === AssessType.trueFalseAssessment
        ? `
            <answerChoices>True</answerChoices>
            <answerChoices>False</answerChoices>
            <correctAnswer>[True/False]</correctAnswer>
            <explanation>[Explanation for Correctness]</explanation>
        `
        : ''
    }
    ${
      assessmentTemplate.assessType === AssessType.singleChoiceAssessment
        ? `
            <answerChoices>[Option 1]</answerChoices>
            <answerChoices>[Option 2]</answerChoices>
            <answerChoices>[Option 3]</answerChoices>
            <answerChoices>[Option 4]</answerChoices>
            <correctAnswer>[Correct Answer Number]</correctAnswer>
            <explanation>[Explanation for Correctness]</explanation>
        `
        : ''
    }
</question>
\`\`\`
    `;
  return prompt;
}
