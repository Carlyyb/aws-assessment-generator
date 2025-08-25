import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { Assessment } from '../graphql/API';

// 添加中文字体支持到jsPDF
// 注意：这需要安装 @types/jspdf 和中文字体
// 如果需要更好的中文支持，可以考虑使用 jspdf-autotable 或 pdfmake

// 导出选项接口
export interface ExportOptions {
  includeQuestions: boolean;
  includeExplanations: boolean;
  includeExplanationsOnly: boolean;
  exportPDF: boolean;
  exportWord: boolean;
  exportJSON: boolean;
}

// 解析数据接口
interface ExplanationItem {
  questionIndex: number;
  explanation: string | null;
  correctAnswer: string | number | number[] | null;
}

interface ExplanationsData {
  multiChoiceExplanations?: ExplanationItem[];
  singleAnswerExplanations?: ExplanationItem[];
  trueFalseExplanations?: ExplanationItem[];
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
  if (assessment.singleAnswerAssessment && Array.isArray(assessment.singleAnswerAssessment)) {
    const startIndex = questions.length;
    assessment.singleAnswerAssessment.forEach((q, index) => {
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

// 使用HTML和canvas生成更好的PDF（支持中文）
const generatePDFWithCanvas = async (assessment: Assessment, options: ExportOptions): Promise<Uint8Array> => {
  const { questions, explanations } = formatQuestionContent(assessment);
  
  // 创建临时的HTML元素
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '-9999px';
  tempDiv.style.width = '800px';
  tempDiv.style.padding = '20px';
  tempDiv.style.fontFamily = 'Microsoft YaHei, SimSun, Arial, sans-serif';
  tempDiv.style.fontSize = '14px';
  tempDiv.style.lineHeight = '1.6';
  tempDiv.style.color = '#000';
  tempDiv.style.backgroundColor = '#fff';
  
  let htmlContent = `<h1 style="font-size: 18px; margin-bottom: 20px;">${assessment.name} - ${assessment.course?.name || ''}</h1>`;
  
  if (options.includeExplanationsOnly) {
    htmlContent += '<h2 style="font-size: 16px; margin: 15px 0 10px 0;">答案解析</h2>';
    explanations.forEach(explanation => {
      htmlContent += `<div style="margin: 10px 0; color: #666;">${explanation}</div>`;
    });
  } else {
    if (options.includeQuestions) {
      htmlContent += '<h2 style="font-size: 16px; margin: 15px 0 10px 0;">题目</h2>';
      questions.forEach((question, index) => {
        htmlContent += `<div style="margin: 15px 0; border-bottom: 1px solid #eee; padding-bottom: 10px;">${question}</div>`;
        
        if (options.includeExplanations && explanations[index]) {
          htmlContent += `<div style="margin-left: 20px; color: #666; font-style: italic;">解析: ${explanations[index]}</div>`;
        }
      });
    }
  }
  
  tempDiv.innerHTML = htmlContent;
  document.body.appendChild(tempDiv);
  
  try {
    // 使用html2canvas捕获内容
    const canvas = await html2canvas(tempDiv, {
      scale: 2, // 提高分辨率
      useCORS: true,
      backgroundColor: '#ffffff'
    });
    
    // 创建PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // 计算缩放比例
    const ratio = Math.min(pdfWidth / canvasWidth * 96 / 25.4, pdfHeight / canvasHeight * 96 / 25.4);
    const scaledWidth = canvasWidth * ratio * 25.4 / 96;
    const scaledHeight = canvasHeight * ratio * 25.4 / 96;
    
    // 如果内容高度超过一页，需要分页
    if (scaledHeight > pdfHeight) {
      const pageHeight = pdfHeight;
      const totalPages = Math.ceil(scaledHeight / pageHeight);
      
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) {
          pdf.addPage();
        }
        
        const startY = i * pageHeight;
        const remainingHeight = Math.min(pageHeight, scaledHeight - startY);
        
        // 裁剪canvas
        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');
        if (cropCtx) {
          cropCanvas.width = canvasWidth;
          cropCanvas.height = remainingHeight * 96 / 25.4 / ratio;
          
          cropCtx.drawImage(
            canvas,
            0, startY * 96 / 25.4 / ratio,
            canvasWidth, cropCanvas.height,
            0, 0,
            canvasWidth, cropCanvas.height
          );
          
          pdf.addImage(cropCanvas.toDataURL('image/png'), 'PNG', 0, 0, scaledWidth, remainingHeight);
        }
      }
    } else {
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, scaledWidth, scaledHeight);
    }
    
    return new Uint8Array(pdf.output('arraybuffer') as ArrayBuffer);
  } finally {
    // 清理临时元素
    document.body.removeChild(tempDiv);
  }
};

// 为PDF创建改进的文本处理（后备方案）
const generatePDFFromHTML = (assessment: Assessment, options: ExportOptions): Uint8Array => {
  const { questions, explanations } = formatQuestionContent(assessment);
  
  // 直接使用jsPDF但改进文本处理，移除未使用的HTML内容
  const doc = new jsPDF();
  doc.setFont('helvetica', 'normal');
  
  let y = 20;
  const lineHeight = 8;
  const pageHeight = doc.internal.pageSize.height;
  
  // 标题
  doc.setFontSize(16);
  const title = `${assessment.name} - ${assessment.course?.name || ''}`;
  doc.text(title, 20, y);
  y += lineHeight * 2;
  
  doc.setFontSize(12);
  
  if (options.includeExplanationsOnly) {
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
    if (options.includeQuestions) {
      doc.text('题目:', 20, y);
      y += lineHeight;
      
      questions.forEach((question, index) => {
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
        
        if (options.includeExplanations && explanations[index]) {
          doc.setFontSize(10);
          doc.text('解析:', 25, y);
          y += lineHeight;
          
          const explanationLines = doc.splitTextToSize(explanations[index], 165);
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
      });
    }
  }
  
  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
};

// 生成PDF内容 - 使用改进的版本
const generatePDF = async (assessment: Assessment, options: ExportOptions): Promise<Uint8Array> => {
  try {
    // 优先使用canvas方法以获得更好的中文支持
    return await generatePDFWithCanvas(assessment, options);
  } catch (error) {
    console.warn('Canvas PDF生成失败，使用后备方案:', error);
    // 如果canvas方法失败，使用后备方案
    return generatePDFFromHTML(assessment, options);
  }
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
          font: "Microsoft YaHei" // 改为支持中文的字体
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
            font: "Microsoft YaHei" // 改为支持中文的字体
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
            font: "Microsoft YaHei" // 改为支持中文的字体
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
              font: "Microsoft YaHei" // 改为支持中文的字体
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
              font: "Microsoft YaHei" // 改为支持中文的字体
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
                  font: "Microsoft YaHei" // 改为支持中文的字体
                }),
                new TextRun({
                  text: explanations[index],
                  font: "Microsoft YaHei" // 改为支持中文的字体
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

interface ExportData {
  id?: string;
  name?: string;
  course?: unknown;
  lectureDate?: string;
  deadline?: string;
  status?: string;
  published?: boolean;
  updatedAt?: string;
  multiChoiceAssessment?: unknown[];
  singleAnswerAssessment?: unknown[];
  trueFalseAssessment?: unknown[];
  freeTextAssessment?: unknown[];
  multiChoiceExplanations?: ExplanationItem[];
  singleAnswerExplanations?: ExplanationItem[];
  trueFalseExplanations?: ExplanationItem[];
}

// 生成JSON数据
const generateJSON = (assessment: Assessment, options: ExportOptions): string => {
  let data: ExportData = {
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
    if (assessment.singleAnswerAssessment) {
      data.singleAnswerAssessment = assessment.singleAnswerAssessment;
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
    const explanationsData: ExplanationsData = {};
    
    if (assessment.multiChoiceAssessment) {
      explanationsData.multiChoiceExplanations = assessment.multiChoiceAssessment.map((q, index) => ({
        questionIndex: index + 1,
        explanation: q?.explanation || null,
        correctAnswer: q?.correctAnswer || null
      }));
    }
    
    if (assessment.singleAnswerAssessment) {
      explanationsData.singleAnswerExplanations = assessment.singleAnswerAssessment.map((q, index) => ({
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
    
    // 题目only
    if (options.includeQuestions && !options.includeExplanations && !options.includeExplanationsOnly) {
      versions.push({ 
        name: '试卷', 
        opts: { ...options, includeQuestions: true, includeExplanations: false, includeExplanationsOnly: false } 
      });
    }
    
    // 题目+解析
    if (options.includeExplanations && !options.includeExplanationsOnly) {
      versions.push({ 
        name: '试卷+解析', 
        opts: { ...options, includeQuestions: true, includeExplanations: true, includeExplanationsOnly: false } 
      });
    }
    
    // 解析only
    if (options.includeExplanationsOnly) {
      versions.push({ 
        name: '解析', 
        opts: { ...options, includeQuestions: false, includeExplanations: false, includeExplanationsOnly: true } 
      });
    }
    
    for (const version of versions) {
      if (options.exportPDF) {
        try {
          const pdfBuffer = await generatePDF(assessment, version.opts);
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
