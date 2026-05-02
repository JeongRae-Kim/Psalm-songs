
import { useState, useEffect } from "react";

export default function MemoEditor({ value, onSave }) {
  const [text, setText] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setText(value);
  }, [value]);

  const handleSave = () => {
    onSave(text);
    setIsOpen(false);
  };

  // 닫힌 상태: 메모가 있으면 미리보기, 없으면 추가 버튼
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full text-left px-4 py-3 bg-card rounded-lg
          border border-b-light shadow-sm
          hover:border-gray-300 transition-colors"
      >
        {value ? (
          <>
            <span className="text-xs text-t-hint block mb-1">메모</span>
            <p className="text-sm text-t-secondary whitespace-pre-line">{value}</p>
          </>
        ) : (
          <span className="text-sm text-t-hint">+ 메모 추가</span>
        )}
      </button>
    );
  }

  // 열린 상태: 편집
  return (
    <div className="bg-card rounded-lg border border-b-default shadow-sm p-4">
      <span className="text-xs text-t-hint block mb-2">메모</span>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="이 곡에 대한 메모를 남겨보세요"
        rows={3}
        className="w-full text-sm text-t-primary border border-b-default rounded-lg
          p-3 resize-none focus:outline-none focus:border-accent
          placeholder-t-muted"
      />
      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={() => { setText(value); setIsOpen(false); }}
          className="px-3 py-1.5 text-xs text-t-secondary
            hover:text-t-primary transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-xs bg-accent text-white
            rounded-lg hover:opacity-90 transition-colors"
        >
          저장
        </button>
      </div>
    </div>
  );
}