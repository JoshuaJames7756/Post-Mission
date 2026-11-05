import { Component, type ReactNode } from 'react'

export class SectionBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  render() {
    if (this.state.failed) return <div className="error-banner" role="alert"><p>No pudimos abrir esta sección. Revisa tu conexión y vuelve a cargarla.</p><button type="button" onClick={() => window.location.reload()}>Volver a cargar</button></div>
    return this.props.children
  }
}
