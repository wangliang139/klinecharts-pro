import { Component, createSignal, For, Show } from 'solid-js'

import { Modal } from '../../component'
import i18n from '../../i18n'
import { getAlertSummaryText } from '../../i18n/trading'
import { AlertItem, AlertItemInput } from '../../types/types'
import AlertAddModal from '../alert-add-modal'
import { AlertDetailFields } from './alert-detail-fields'

export interface AlertModalProps {
  locale: string
  alerts: AlertItem[]
  onClose: () => void
  onAddAlert?: (alert: AlertItemInput) => boolean | Promise<boolean>
  onRemoveAlert?: (alert: AlertItem) => boolean | Promise<boolean>
}

const AlertModal: Component<AlertModalProps> = (props) => {
  const [addVisible, setAddVisible] = createSignal(false)
  const [detail, setDetail] = createSignal<AlertItem | null>(null)

  return (
    <Modal
      title={i18n('alerts', props.locale)}
      width={480}
      onClose={props.onClose}
    >
      <div class="klinecharts-pro-alert-modal">
        <div class="alert-list">
          <For each={props.alerts}>
            {(alertItem) => (
              <div
                class="alert-item"
                onDblClick={() => { setDetail(alertItem) }}
                title={i18n('alert_double_click_detail', props.locale)}
              >
                <span class="alert-text">
                  {getAlertSummaryText(alertItem, props.locale)}
                </span>
                <button
                  type="button"
                  class="alert-delete"
                  onClick={async () => { await props.onRemoveAlert?.(alertItem) }}
                  onDblClick={(e) => { e.stopPropagation() }}
                >
                  {i18n('alert_delete', props.locale)}
                </button>
              </div>
            )}
          </For>
          <Show when={props.alerts.length === 0}>
            <div class="alert-empty">{i18n('alert_empty', props.locale)}</div>
          </Show>
        </div>
        <div class="alert-add-btn-container">
          <button
            type="button"
            class="alert-add-btn"
            onClick={() => { setAddVisible(true) }}
          >
            {i18n('alert_add', props.locale)}
          </button>
        </div>
      </div>
      <Show when={addVisible()}>
        <AlertAddModal
          locale={props.locale}
          onClose={() => { setAddVisible(false) }}
          onSubmit={async (payload) => {
            return (await props.onAddAlert?.(payload)) ?? true
          }}
        />
      </Show>
      <Show when={detail()}>
        {(w) => (
          <Modal
            title={i18n('alert_detail', props.locale)}
            width={400}
            height={260}
            onClose={() => { setDetail(null) }}
          >
            <div class="klinecharts-pro-alert-detail">
              <AlertDetailFields locale={props.locale} alert={w()} />
            </div>
          </Modal>
        )}
      </Show>
    </Modal>
  )
}

export default AlertModal
