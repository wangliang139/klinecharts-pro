import { Component, createSignal, For, Show } from 'solid-js'

import { Modal } from '../../component'
import { WarningItem, WarningItemInput } from '../../types/types'
import WarningAddModal from '../warning-add-modal'

export interface WarningModalProps {
  warnings: WarningItem[]
  onClose: () => void
  onAddWarning?: (warning: WarningItemInput) => void | Promise<void>
  onRemoveWarning?: (warning: WarningItem) => void | Promise<void>
}

const WarningModal: Component<WarningModalProps> = (props) => {
  const [addVisible, setAddVisible] = createSignal(false)

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
              <div class="warning-item">
                <span class="warning-text">
                  {warning.type === 'price_reach' && `价格达到 ${warning.price ?? '--'}`}
                  {warning.type === 'price_rise_to' && `价格上涨至 ${warning.price ?? '--'}`}
                  {warning.type === 'price_fall_to' && `价格下跌至 ${warning.price ?? '--'}`}
                  {warning.type === 'price_rise_pct_over' && `价格${warning.window ?? '5m'}涨幅 ${warning.percent ?? '--'}%`}
                  {warning.type === 'price_fall_pct_over' && `价格${warning.window ?? '5m'}跌幅 ${warning.percent ?? '--'}%`}
                </span>
                <button
                  type="button"
                  class="warning-delete"
                  onClick={() => { props.onRemoveWarning?.(warning) }}
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
    </Modal>
  )
}

export default WarningModal
