export default function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[200] bg-on-surface/10 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white rounded-2xl px-6 py-5 flex items-center gap-3 shadow-md3-2">
        <span className="material-symbols-outlined text-primary animate-spin" style={{ fontSize: 24 }}>sync</span>
        <span className="text-sm text-on-surface font-medium">Đang xử lý...</span>
      </div>
    </div>
  )
}
