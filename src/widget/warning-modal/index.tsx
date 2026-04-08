import { Component, createSignal, For, Show } from 'solid-js'

import { Modal } from '../../component'
import { WarningItem, WarningItemInput } from '../../types/types'
import WarningAddModal from '../warning-add-modal'
import { WarningDetailFields } from '../warning-detail-fields'

export interface WarningModalProps {
  warnings: WarningItem[]
  onClose: () => void
  onAddWarning?: (warning: WarningItemInput) => void | Promise<void>
  onRemoveWarning?: (warning: WarningItem) => void | Promise<void>
}

function summaryLine(warning: WarningItem): string {
  if (warning.type === 'price_reach') return `价格达到 ${warning.price ?? '--'}`
  if (warning.type === 'price_rise_to') return `价格上涨至 ${warning.price ?? '--'}`
  if (warning.type === 'price_fall_to') return `价格下跌至 ${warning.price ?? '--'}`
  if (warning.type === 'price_rise_pct_over') return `价格${warning.window ?? '5m'}涨幅 ${warning.percent ?? '--'}%`
  return `价格${warning.window ?? '5m'}跌幅 ${warning.percent ?? '--'}%`
}

const WarningModal: Component<WarningModalProps> = (props) => {
  const [addVisible, setAddVisible] = createSignal(false)
  const [detail, setDetail] = createSignal<WarningItem | null>(null)

  return (
    <Modal
      title="预警"
      width={480}
      height={420}
      onClose={props.onClose}
    >
      <div class="klinecharts-pro-warning-modal">
        <div class="warning-list">
          <For each={props.warnings}>
            {(warning) => (
              <div
                class="warning-item"
                onDblClick={() => { setDetail(warning) }}
                title="双击查看详情"
              >
                <span class="warning-text">
                  {summaryLine(warning)}
                </span>
                <button
                  type="button"
                  class="warning-delete"
                  onClick={() => { props.onRemoveWarning?.(warning) }}
                  onDblClick={(e) => { e.stopPropagation() }}
                >
                  删除
                </button>
              </div>
            )}
          </For>
          <Show when={props.warnings.length === 0}>
            <div class="warning-empty">暂无预警</div>
          </Show>
          <button
            type="button"
            class="warning-add-btn"
            onClick={() => { setAddVisible(true) }}
          >
            添加
          </button>
        </div>
      </div>
      <Show when={addVisible()}>
        <WarningAddModal
          onClose={() => { setAddVisible(false) }}
          onSubmit={async (payload) => {
            await props.onAddWarning?.(payload)
          }}
        />
      </Show>
      <Show when={detail()}>
        {(w) => (
          <Modal
            title="预警详情"
            width={400}
            height={260}
            onClose={() => { setDetail(null) }}
          >
            <div class="klinecharts-pro-warning-detail">
              <WarningDetailFields warning={w()} />
            </div>
          </Modal>
        )}
      </Show>
    </Modal>
  )
}

export default WarningModal
