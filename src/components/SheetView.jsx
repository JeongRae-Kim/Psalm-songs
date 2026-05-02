
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export default function SheetView({ sheetImage, sheetPdf, title }) {
  return (
    <div className="flex flex-col">
      {/* 악보 이미지 + 핀치 줌 */}
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={3}
        doubleClick={{ mode: "toggle", step: 0.7 }}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", minHeight: "60vh" }}
          contentStyle={{ width: "100%" }}
        >
          <img
            src={sheetImage}
            alt={`${title} 악보`}
            className="w-full h-auto"
          />
        </TransformComponent>
      </TransformWrapper>

      {/* 줌 안내 */}
      <p className="text-center text-xs text-t-hint py-2">
        두 손가락으로 확대 · 더블탭으로 줌 토글
      </p>

      {/* PDF 다운로드 버튼 */}
      <div className="px-4 pb-6 pt-2">
        <a
          href={sheetPdf}
          download
          className="block w-full text-center py-3 rounded-lg
            bg-accent text-white text-sm font-medium
            hover:opacity-90 active:bg-gray-900
            transition-colors"
        >
          PDF 다운로드
        </a>
      </div>
    </div>
  );
}