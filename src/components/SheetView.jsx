
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export default function SheetView({ sheetImage, sheetPdf, title }) {
  return (
    <div className="flex flex-col">
      {/* 악보 영역 — overflow-hidden으로 탭 바 위로 넘침 방지 */}
      <div className="overflow-hidden relative" style={{ maxHeight: "75vh" }}>
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={3}
          doubleClick={{ mode: "toggle", step: 0.7 }}
          centerOnInit={false}
          limitToBounds={true}
          panning={{ velocityDisabled: true }}
          alignmentAnimation={{ sizeX: 0, sizeY: 0 }}
        >
          <TransformComponent
            wrapperStyle={{
              width: "100%",
              maxHeight: "75vh",
              overflow: "hidden",
            }}
            contentStyle={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              transformOrigin: "top left",
            }}
          >
            <img
              src={sheetImage}
              alt={`${title} 악보`}
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                backgroundColor: "#faf8f4",
              }}
            />
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* 줌 안내 */}
      <p className="text-center text-t-hint py-1.5"
         style={{ fontSize: "0.65rem", opacity: 0.6 }}>
        두 손가락으로 확대 · 더블탭으로 줌 토글
      </p>

      {/* PDF 다운로드 버튼 */}
      <div className="px-4 pb-6 pt-1">
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
