import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Assessment } from '../graphql/API';

// 导出选项接口
export interface ExportOptions {
  includeQuestions: boolean;
  includeExplanations: boolean;
  includeExplanationsOnly: boolean;
  exportPDF: boolean;
  exportWord: boolean;
  exportJSON: boolean;
}

// 格式化题目内容
const formatQuestionContent = (
  assessment: Assessment
): { questions: string[]; explanations: string[] } => {
  const questions: string[] = [];
  const explanations: string[] = [];

  // 处理多选题
  if (assessment.multiChoiceAssessment && Array.isArray(assessment.multiChoiceAssessment)) {
    assessment.multiChoiceAssessment.forEach((q, index) => {
      if (q) {
        const questionText = `${index + 1}. ${q.question || ''}\n${
          q.answerChoices ? q.answerChoices.join('\n') : ''
        }`;
        questions.push(questionText);
        
        if (q.explanation) {
          explanations.push(`${index + 1}. ${q.explanation}`);
        }
      }
    });
  }

  // 处理单选题
  if (assessment.singleChoiceAssessment && Array.isArray(assessment.singleChoiceAssessment)) {
    const startIndex = questions.length;
    assessment.singleChoiceAssessment.forEach((q, index) => {
      if (q) {
        const questionText = `${startIndex + index + 1}. ${q.question || ''}\n${
          q.answerChoices ? q.answerChoices.join('\n') : ''
        }`;
        questions.push(questionText);
        
        if (q.explanation) {
          explanations.push(`${startIndex + index + 1}. ${q.explanation}`);
        }
      }
    });
  }

  // 处理判断题
  if (assessment.trueFalseAssessment && Array.isArray(assessment.trueFalseAssessment)) {
    const startIndex = questions.length;
    assessment.trueFalseAssessment.forEach((q, index) => {
      if (q) {
        const questionText = `${startIndex + index + 1}. ${q.question || ''}\n${
          q.answerChoices ? q.answerChoices.join('\n') : ''
        }`;
        questions.push(questionText);
        
        if (q.explanation) {
          explanations.push(`${startIndex + index + 1}. ${q.explanation}`);
        }
      }
    });
  }

  // 处理自由文本题
  if (assessment.freeTextAssessment && Array.isArray(assessment.freeTextAssessment)) {
    const startIndex = questions.length;
    assessment.freeTextAssessment.forEach((q, index) => {
      if (q) {
        const questionText = `${startIndex + index + 1}. ${q.question || ''}`;
        questions.push(questionText);
        
        // 自由文本题通常没有标准解析
        explanations.push(`${startIndex + index + 1}. (主观题，无标准答案)`);
      }
    });
  }

  return { questions, explanations };
};

// 生成PDF内容
const generatePDF = (assessment: Assessment, options: ExportOptions): Uint8Array => {
  const doc = new jsPDF();
  const { questions, explanations } = formatQuestionContent(assessment);
  
  // 设置字体（中文使用宋体风格，英文使用Times）
  doc.setFont('times');
  
  let y = 20;
  const lineHeight = 8;
  const pageHeight = doc.internal.pageSize.height;
  
  // 标题
  doc.setFontSize(16);
  doc.text(`${assessment.name} - ${assessment.course?.name || ''}`, 20, y);
  y += lineHeight * 2;
  
  doc.setFontSize(12);
  
  // 根据选项输出内容
  if (options.includeExplanationsOnly) {
    // 只输出解析
    doc.text('答案解析:', 20, y);
    y += lineHeight;
    
    explanations.forEach(explanation => {
      const lines = doc.splitTextToSize(explanation, 170);
      lines.forEach((line: string) => {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += lineHeight;
      });
      y += lineHeight / 2;
    });
  } else {
    // 输出题目
    if (options.includeQuestions) {
      doc.text('题目:', 20, y);
      y += lineHeight;
      
      questions.forEach(question => {
        const lines = doc.splitTextToSize(question, 170);
        lines.forEach((line: string) => {
          if (y > pageHeight - 20) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, 20, y);
          y += lineHeight;
        });
        y += lineHeight;
        
        // 如果选择了题目+解析，在每题后面紧跟解析
        if (options.includeExplanations && explanations.length > 0) {
          const questionIndex = questions.indexOf(question);
          if (questionIndex < explanations.length && explanations[questionIndex]) {
            doc.setFontSize(10);
            doc.text('解析:', 25, y);
            y += lineHeight;
            
            const explanationLines = doc.splitTextToSize(explanations[questionIndex], 165);
            explanationLines.forEach((line: string) => {
              if (y > pageHeight - 20) {
                doc.addPage();
                y = 20;
              }
              doc.text(line, 25, y);
              y += lineHeight;
            });
            
            doc.setFontSize(12);
            y += lineHeight;
          }
        }
      });
    }
  }
  
  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
};

// 生成Word文档
const generateWordDoc = async (assessment: Assessment, options: ExportOptions): Promise<Uint8Array> => {
  const { questions, explanations } = formatQuestionContent(assessment);
  
  const children: Paragraph[] = [];
  
  // 标题
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${assessment.name} - ${assessment.course?.name || ''}`,
          bold: true,
          size: 32,
          font: "Times New Roman"
        }),
      ],
      heading: HeadingLevel.HEADING_1,
    })
  );
  
  // 根据选项添加内容
  if (options.includeExplanationsOnly) {
    // 只输出解析
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '答案解析',
            bold: true,
            size: 24,
            font: "Times New Roman"
          }),
        ],
        heading: HeadingLevel.HEADING_2,
      })
    );
    
    explanations.forEach(explanation => {
      children.push(
        new Paragraph({
          children: [new TextRun({ 
            text: explanation,
            font: "Times New Roman"
          })],
        })
      );
    });
  } else {
    // 输出题目
    if (options.includeQuestions) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '题目',
              bold: true,
              size: 24,
              font: "Times New Roman"
            }),
          ],
          heading: HeadingLevel.HEADING_2,
        })
      );
      
      questions.forEach((question, index) => {
        children.push(
          new Paragraph({
            children: [new TextRun({ 
              text: question,
              font: "Times New Roman"
            })],
          })
        );
        
        // 如果选择了题目+解析，在每题后面紧跟解析
        if (options.includeExplanations && explanations[index]) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: '解析: ',
                  bold: true,
                  font: "Times New Roman"
                }),
                new TextRun({
                  text: explanations[index],
                  font: "Times New Roman"
                }),
              ],
            })
          );
        }
        
        children.push(new Paragraph({ children: [new TextRun({ text: '' })] })); // 空行
      });
    }
  }
  
  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });
  
  // 修复nodebuffer问题，使用blob方式
  return await Packer.toBlob(doc).then(blob => {
    return blob.arrayBuffer().then(buffer => new Uint8Array(buffer));
  });
};

// 生成JSON数据
const generateJSON = (assessment: Assessment, options: ExportOptions): string => {
  let data: any = {
    id: assessment.id,
    name: assessment.name,
    course: assessment.course,
    lectureDate: assessment.lectureDate,
    deadline: assessment.deadline,
    status: assessment.status,
    published: assessment.published,
    updatedAt: assessment.updatedAt
  };

  if (options.includeQuestions || !options.includeExplanationsOnly) {
    if (assessment.multiChoiceAssessment) {
      data.multiChoiceAssessment = assessment.multiChoiceAssessment;
    }
    if (assessment.singleChoiceAssessment) {
      data.singleChoiceAssessment = assessment.singleChoiceAssessment;
    }
    if (assessment.trueFalseAssessment) {
      data.trueFalseAssessment = assessment.trueFalseAssessment;
    }
    if (assessment.freeTextAssessment) {
      data.freeTextAssessment = assessment.freeTextAssessment;
    }
  }

  if (options.includeExplanationsOnly) {
    // 只包含解析部分
    const explanationsData: any = {};
    
    if (assessment.multiChoiceAssessment) {
      explanationsData.multiChoiceExplanations = assessment.multiChoiceAssessment.map((q, index) => ({
        questionIndex: index + 1,
        explanation: q?.explanation || null,
        correctAnswer: q?.correctAnswer || null
      }));
    }
    
    if (assessment.singleChoiceAssessment) {
      explanationsData.singleChoiceExplanations = assessment.singleChoiceAssessment.map((q, index) => ({
        questionIndex: index + 1,
        explanation: q?.explanation || null,
        correctAnswer: q?.correctAnswer || null
      }));
    }
    
    if (assessment.trueFalseAssessment) {
      explanationsData.trueFalseExplanations = assessment.trueFalseAssessment.map((q, index) => ({
        questionIndex: index + 1,
        explanation: q?.explanation || null,
        correctAnswer: q?.correctAnswer || null
      }));
    }
    
    data = { ...data, ...explanationsData };
  }

  return JSON.stringify(data, null, 2);
};

// 主导出函数
export const exportAssessments = async (
  assessments: Assessment[],
  options: ExportOptions
): Promise<void> => {
  const zip = new JSZip();
  
  for (const assessment of assessments) {
    const baseName = `${assessment.name}-${assessment.course?.name || '未知课程'}`;
    
    // 根据选项生成不同版本
    const versions = [];
    
    if (options.includeQuestions && !options.includeExplanations && !options.includeExplanationsOnly) {
      versions.push({ 
        name: '试卷', 
        opts: { ...options, includeQuestions: true, includeExplanations: false, includeExplanationsOnly: false } 
      });
    }
    
    if (options.includeQuestions && options.includeExplanations && !options.includeExplanationsOnly) {
      versions.push({ 
        name: '试卷+解析', 
        opts: { ...options, includeQuestions: true, includeExplanations: true, includeExplanationsOnly: false } 
      });
    }
    
    if (options.includeExplanationsOnly) {
      versions.push({ 
        name: '解析', 
        opts: { ...options, includeQuestions: false, includeExplanations: false, includeExplanationsOnly: true } 
      });
    }
    
    for (const version of versions) {
      if (options.exportPDF) {
        try {
          const pdfBuffer = generatePDF(assessment, version.opts);
          zip.file(`${baseName}-${version.name}.pdf`, pdfBuffer);
        } catch (error) {
          console.error(`生成PDF失败 (${baseName}-${version.name}):`, error);
        }
      }
      
      if (options.exportWord) {
        try {
          const wordBuffer = await generateWordDoc(assessment, version.opts);
          zip.file(`${baseName}-${version.name}.docx`, wordBuffer);
        } catch (error) {
          console.error(`生成Word文档失败 (${baseName}-${version.name}):`, error);
        }
      }
      
      if (options.exportJSON) {
        try {
          const jsonContent = generateJSON(assessment, version.opts);
          // 确保使用UTF-8编码
          const jsonBlob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
          const jsonBuffer = await jsonBlob.arrayBuffer();
          zip.file(`${baseName}-${version.name}.json`, new Uint8Array(jsonBuffer));
        } catch (error) {
          console.error(`生成JSON失败 (${baseName}-${version.name}):`, error);
        }
      }
    }
  }
  
  // 生成压缩包
  const zipBlob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  
  // 确定压缩包文件名
  let fileName: string;
  if (assessments.length === 1) {
    const assessment = assessments[0];
    const baseName = `${assessment.name}-${assessment.course?.name || '未知课程'}`;
    
    // 确定导出的内容类型和格式
    const contentTypes = [];
    if (options.includeQuestions && !options.includeExplanations && !options.includeExplanationsOnly) {
      contentTypes.push('试卷');
    }
    if (options.includeExplanationsOnly) {
      contentTypes.push('解析');
    }
    if (options.includeQuestions && options.includeExplanations && !options.includeExplanationsOnly) {
      contentTypes.push('试卷+解析');
    }
    
    const formats = [];
    if (options.exportPDF) formats.push('pdf');
    if (options.exportWord) formats.push('docx');
    if (options.exportJSON) formats.push('json');
    
    const contentSuffix = contentTypes.join('+');
    const formatSuffix = formats.join('+');
    fileName = `${baseName}(${contentSuffix} ${formatSuffix}).zip`;
  } else {
    fileName = `批量导出-${assessments.length}个测试.zip`;
  }
  
  saveAs(zipBlob, fileName);
};
