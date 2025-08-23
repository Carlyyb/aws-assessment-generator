import React, { useState } from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  Checkbox,
  FormField,
  Alert,
} from '@cloudscape-design/components';
import { ExportOptions } from '../utils/exportUtils';

interface ExportModalProps {
  visible: boolean;
  onDismiss: () => void;
  onExport: (options: ExportOptions) => void;
  isExporting: boolean;
  selectedCount: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  visible,
  onDismiss,
  onExport,
  isExporting,
  selectedCount,
}) => {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeQuestions: true,
    includeExplanations: false,
    includeExplanationsOnly: false,
    exportPDF: true,
    exportWord: false,
    exportJSON: false,
  });

  const handleExport = () => {
    // 验证至少选择了一种内容和一种格式
    const hasContent = 
      exportOptions.includeQuestions || 
      exportOptions.includeExplanations || 
      exportOptions.includeExplanationsOnly;
    const hasFormat = exportOptions.exportPDF || exportOptions.exportWord || exportOptions.exportJSON;
    
    if (hasContent && hasFormat) {
      onExport(exportOptions);
    }
  };

  const updateOption = (key: keyof ExportOptions, value: boolean) => {
    setExportOptions(prev => {
      const newOptions = { ...prev, [key]: value };
      
      // 如果选择了"解析only"，取消其他内容选项
      if (key === 'includeExplanationsOnly' && value) {
        newOptions.includeQuestions = false;
        newOptions.includeExplanations = false;
      }
      
      // 如果选择了其他内容选项，取消"解析only"
      if ((key === 'includeQuestions' || key === 'includeExplanations') && value) {
        newOptions.includeExplanationsOnly = false;
      }
      
      return newOptions;
    });
  };

  const hasValidSelection = () => {
    const hasContent = 
      exportOptions.includeQuestions || 
      exportOptions.includeExplanations || 
      exportOptions.includeExplanationsOnly;
    const hasFormat = exportOptions.exportPDF || exportOptions.exportWord || exportOptions.exportJSON;
    return hasContent && hasFormat;
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header="导出设置"
      size="medium"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              取消
            </Button>
            <Button 
              variant="primary" 
              onClick={handleExport}
              disabled={!hasValidSelection() || isExporting}
              loading={isExporting}
            >
              导出
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        <Alert type="info">
          将导出 {selectedCount} 个测试。每个测试将根据您的选择生成对应的文件版本，最终打包为ZIP文件。
        </Alert>

        <FormField label="导出内容" description="选择要导出的内容类型">
          <SpaceBetween size="s">
            <Checkbox
              checked={exportOptions.includeQuestions}
              onChange={({ detail }) => updateOption('includeQuestions', detail.checked)}
            >
              题目only
            </Checkbox>
            <Checkbox
              checked={exportOptions.includeExplanations}
              onChange={({ detail }) => updateOption('includeExplanations', detail.checked)}
            >
              题目+解析（在题目后紧跟解析）
            </Checkbox>
            <Checkbox
              checked={exportOptions.includeExplanationsOnly}
              onChange={({ detail }) => updateOption('includeExplanationsOnly', detail.checked)}
            >
              解析only
            </Checkbox>
          </SpaceBetween>
        </FormField>

        <FormField label="导出格式" description="选择导出的文件格式">
          <SpaceBetween size="s">
            <Checkbox
              checked={exportOptions.exportPDF}
              onChange={({ detail }) => updateOption('exportPDF', detail.checked)}
            >
              PDF格式
            </Checkbox>
            <Checkbox
              checked={exportOptions.exportWord}
              onChange={({ detail }) => updateOption('exportWord', detail.checked)}
            >
              Word格式 (.docx)
            </Checkbox>
            <Checkbox
              checked={exportOptions.exportJSON}
              onChange={({ detail }) => updateOption('exportJSON', detail.checked)}
            >
              JSON格式 (数据库数据)
            </Checkbox>
          </SpaceBetween>
        </FormField>

        {!hasValidSelection() && (
          <Alert type="warning">
            请至少选择一种导出内容和一种导出格式。
          </Alert>
        )}
      </SpaceBetween>
    </Modal>
  );
};
