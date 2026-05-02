import { useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export default function SheetView({ sheetImage, title }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)",
        minHeight: "100%",
      }}
    >
      {/* 악보 액자 — 페이드인 애니메이션 */}
      <div
        style={{
          width: "130%",
          padding: "12px",
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
              boxShadow:
                "0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)",
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
        <div className="flex items-center justify-center py-20">
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>
            악보를 불러오는 중…
          </p>
        </div>
      )}
    </div>
  );
}
