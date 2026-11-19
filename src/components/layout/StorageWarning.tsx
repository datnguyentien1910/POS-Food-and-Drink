import { TriangleAlert } from 'lucide-react'
import { usePOSStore } from '../../store/usePOSStore'

export function StorageWarning() {
  const storageError = usePOSStore((state) => state.storageError)

  if (!storageError) return null

  return (
    <div
      role="alert"
      className="fixed inset-x-3 top-3 z-[100] flex items-start gap-2.5 rounded-xl border border-negative/30 bg-negative px-4 py-3 text-xs font-semibold text-white shadow-pop"
    >
      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
      <p>
        Không lưu được dữ liệu trên trình duyệt. Đơn hiện tại có thể mất khi
        tải lại trang — hãy kiểm tra dung lượng bộ nhớ hoặc chế độ ẩn danh.
      </p>
    </div>
  )
}
