import style from "./content-error.module.css"
import { type JSX, createSignal, Show } from "solid-js"
import { createOverflow } from "./common"

interface Props extends JSX.HTMLAttributes<HTMLDivElement> {
  expand?: boolean
  title?: string
  type?: "error" | "warning" | "info"
  recoverable?: boolean
  onRetry?: () => void
}

export function ContentError(props: Props) {
  const [expanded, setExpanded] = createSignal(false)
  const overflow = createOverflow()

  const getIcon = () => {
    switch (props.type) {
      case "warning":
        return "⚠️"
      case "info":
        return "ℹ️"
      default:
        return "❌"
    }
  }

  return (
    <div
      class={style.root}
      data-expanded={expanded() || props.expand === true ? true : undefined}
      data-type={props.type || "error"}
    >
      <Show when={props.title || props.type}>
        <div data-section="header" class={style.header}>
          <span class={style.icon}>{getIcon()}</span>
          <span class={style.title}>{props.title || "Error"}</span>
        </div>
      </Show>
      <div data-section="content" ref={overflow.ref}>
        {props.children}
      </div>
      <Show when={props.recoverable && props.onRetry}>
        <div data-section="actions" class={style.actions}>
          <button type="button" class={style.retryButton} onClick={props.onRetry}>
            🔄 Retry
          </button>
        </div>
      </Show>
      {((!props.expand && overflow.status) || expanded()) && (
        <button
          type="button"
          data-element-button-text
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded() ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  )
}
