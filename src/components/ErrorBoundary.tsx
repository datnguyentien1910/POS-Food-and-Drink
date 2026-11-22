import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui/Button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleBackToPos = () => {
    window.location.hash = '#/pos'
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-dvh place-items-center bg-bg px-6">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-pop">
            <h1 className="text-xl font-extrabold text-ink">Đã xảy ra lỗi</h1>
            <p className="mt-2 text-sm leading-snug text-muted">
              Hệ thống gặp sự cố ngoài ý muốn. Vui lòng tải lại trang hoặc quay
              về màn hình POS để tiếp tục.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={this.handleReload}>Tải lại</Button>
              <Button variant="secondary" onClick={this.handleBackToPos}>
                Về POS
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
