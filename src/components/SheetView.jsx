
import { useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export default function SheetView({ sheetImage, sheetPdf, title }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="flex flex-col">
      {/* 악보 영역 — 갤러리 배경 + 넘침 방지 */}
      <div
        className="overflow-hidden relative"
        style={{
          maxHeight: "75vh",
          background: "linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)",
        }}
      >
        {/* 악보 액자 — 페이드인 애니메이션 */}
        <div
          className="p-4"
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
          }}
        >
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={3}
            doubleClick={{ mode: "toggle", step: 0.7 }}
            centerOnInit={false}
            limitToBounds={true}
            panning={{ disabled: true }}
            alignmentAnimation={{ sizeX: 0, sizeY: 0 }}
          >
            <TransformComponent
              wrapperStyle={{
                width: "100%",
                overflow: "hidden",
                borderRadius: "8px",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)",
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
                onLoad={() => setLoaded(true)}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  backgroundColor: "#faf8f4",
                  borderRadius: "8px",
                }}
              />
            </TransformComponent>
          </TransformWrapper>
        </div>

        {/* 로딩 중 표시 */}
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>
              악보를 불러오는 중…
            </p>
          </div>
        )}
      </div>

      {/* 줌 안내 */}
      <p
        className="text-center text-t-hint py-1.5"
        style={{ fontSize: "0.65rem", opacity: 0.6 }}
      >
        두 손가락으로 확대/축소 · 더블탭으로 줌 토글
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
