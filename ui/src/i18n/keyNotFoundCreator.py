import json
import re
import os
from typing import Dict, List, Tuple, Any

class TranslationKeyManager:
    def __init__(self, zh_file_path: str = "zh.json", en_file_path: str = "en.json"):
        """
        初始化翻译键管理器
        
        Args:
            zh_file_path: 中文翻译文件路径
            en_file_path: 英文翻译文件路径
        """
        self.zh_file_path = zh_file_path
        self.en_file_path = en_file_path
        self.zh_data = {}
        self.en_data = {}
        
        # 加载现有的翻译文件
        self.load_translation_files()
    
    def load_translation_files(self):
        """加载翻译文件"""
        try:
            if os.path.exists(self.zh_file_path):
                with open(self.zh_file_path, 'r', encoding='utf-8') as f:
                    self.zh_data = json.load(f)
            else:
                print(f"警告: {self.zh_file_path} 不存在，将创建新文件")
                
            if os.path.exists(self.en_file_path):
                with open(self.en_file_path, 'r', encoding='utf-8') as f:
                    self.en_data = json.load(f)
            else:
                print(f"警告: {self.en_file_path} 不存在，将创建新文件")
                
        except json.JSONDecodeError as e:
            print(f"JSON文件解析错误: {e}")
        except Exception as e:
            print(f"文件加载错误: {e}")
    
    def parse_log_input(self, log_text: str) -> List[Tuple[str, str]]:
        """
        解析日志输入，提取翻译键和语言
        
        Args:
            log_text: 包含翻译错误的日志文本
            
        Returns:
            List of tuples containing (translation_key, language)
        """
        pattern = r'Translation key not found: (.+?) in language: (\w+)'
        matches = re.findall(pattern, log_text)
        return matches
    
    def get_nested_value(self, data: Dict, key_path: str) -> Any:
        """
        根据键路径获取嵌套字典中的值
        
        Args:
            data: 字典数据
            key_path: 键路径，如 "studentAssessments.title"
            
        Returns:
            值或None（如果不存在）
        """
        keys = key_path.split('.')
        current = data
        
        try:
            for key in keys:
                current = current[key]
            return current
        except (KeyError, TypeError):
            return None
    
    def set_nested_value(self, data: Dict, key_path: str, value: str = ""):
        """
        在嵌套字典中设置值
        
        Args:
            data: 字典数据
            key_path: 键路径
            value: 要设置的值
        """
        keys = key_path.split('.')
        current = data
        
        # 创建嵌套结构
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]
        
        # 设置最终值
        current[keys[-1]] = value
    
    def check_key_existence(self, translation_keys: List[str]) -> Dict[str, Dict[str, bool]]:
        """
        检查翻译键在两种语言中的存在性
        
        Args:
            translation_keys: 翻译键列表
            
        Returns:
            字典，包含每个键在zh和en中的存在状态
        """
        results = {}
        
        for key in translation_keys:
            zh_exists = self.get_nested_value(self.zh_data, key) is not None
            en_exists = self.get_nested_value(self.en_data, key) is not None
            
            results[key] = {
                'zh': zh_exists,
                'en': en_exists
            }
        
        return results
    
    def display_check_results(self, check_results: Dict[str, Dict[str, bool]]):
        """显示检查结果"""
        print("\n=== 翻译键存在性检查结果 ===")
        print(f"{'翻译键':<40} {'中文(zh)':<10} {'英文(en)':<10}")
        print("-" * 65)
        
        for key, status in check_results.items():
            zh_status = "✓" if status['zh'] else "✗"
            en_status = "✓" if status['en'] else "✗"
            print(f"{key:<40} {zh_status:<10} {en_status:<10}")
    
    def add_missing_keys(self, translation_keys: List[str]):
        """
        添加缺失的翻译键
        
        Args:
            translation_keys: 需要添加的翻译键列表
        """
        for key in translation_keys:
            zh_exists = self.get_nested_value(self.zh_data, key) is not None
            en_exists = self.get_nested_value(self.en_data, key) is not None
            
            if not zh_exists:
                self.set_nested_value(self.zh_data, key, "")
                print(f"已在zh.json中添加键: {key}")
            
            if not en_exists:
                self.set_nested_value(self.en_data, key, "")
                print(f"已在en.json中添加键: {key}")
    
    def save_translation_files(self):
        """保存翻译文件"""
        try:
            # 保存中文翻译文件
            with open(self.zh_file_path, 'w', encoding='utf-8') as f:
                json.dump(self.zh_data, f, ensure_ascii=False, indent=2)
            
            # 保存英文翻译文件
            with open(self.en_file_path, 'w', encoding='utf-8') as f:
                json.dump(self.en_data, f, ensure_ascii=False, indent=2)
            
            print(f"\n翻译文件已保存:")
            print(f"- {self.zh_file_path}")
            print(f"- {self.en_file_path}")
            
        except Exception as e:
            print(f"保存文件时出错: {e}")
    
    def process_log_input(self, log_text: str):
        """
        处理日志输入的完整流程
        
        Args:
            log_text: 包含翻译错误的日志文本
        """
        # 解析日志
        matches = self.parse_log_input(log_text)
        
        if not matches:
            print("未找到翻译键错误信息")
            return
        
        # 提取唯一的翻译键
        translation_keys = list(set([match[0] for match in matches]))
        
        print(f"发现 {len(translation_keys)} 个缺失的翻译键:")
        for key in translation_keys:
            print(f"- {key}")
        
        # 检查存在性
        check_results = self.check_key_existence(translation_keys)
        self.display_check_results(check_results)
        
        # 询问是否继续
        print(f"\n是否要添加缺失的翻译键？(y/n): ", end="")
        confirm = input().strip().lower()
        
        if confirm in ['y', 'yes', '是']:
            self.add_missing_keys(translation_keys)
            self.save_translation_files()
            print("\n✓ 处理完成!")
        else:
            print("操作已取消")


def main():
    """主函数"""
    print("=== 翻译键管理工具 ===")
    
    # 获取翻译文件路径
    zh_file = input("请输入中文翻译文件路径 (默认: zh.json): ").strip() or "zh.json"
    en_file = input("请输入英文翻译文件路径 (默认: en.json): ").strip() or "en.json"
    
    # 创建管理器
    manager = TranslationKeyManager(zh_file, en_file)
    
    print("\n请输入包含翻译错误的日志内容 (输入 'END' 结束):")
    log_lines = []
    
    while True:
        line = input()
        if line.strip() == 'END':
            break
        log_lines.append(line)
    
    log_text = '\n'.join(log_lines)
    
    if log_text.strip():
        manager.process_log_input(log_text)
    else:
        print("未输入任何日志内容")


if __name__ == "__main__":
    main()


# 示例用法
def example_usage():
    """示例用法"""
    log_input = """
    index-C-MkTNHT.js:435 
     Translation key not found: studentAssessments.title in language: zh
    index-C-MkTNHT.js:435 
     Translation key not found: studentAssessments.table.name in language: zh
    index-C-MkTNHT.js:435 
     Translation key not found: studentAssessments.table.course in language: zh
    index-C-MkTNHT.js:435 
     Translation key not found: studentAssessments.table.deadline in language: zh
    index-C-MkTNHT.js:435 
     Translation key not found: studentAssessments.table.action in language: zh
    """
    
    manager = TranslationKeyManager()
    manager.process_log_input(log_input)


# 快速处理函数
def quick_process(log_text: str, zh_file: str = "zh.json", en_file: str = "en.json"):
    """
    快速处理函数，适合脚本调用
    
    Args:
        log_text: 日志文本
        zh_file: 中文翻译文件路径
        en_file: 英文翻译文件路径
    """
    manager = TranslationKeyManager(zh_file, en_file)
    manager.process_log_input(log_text)
