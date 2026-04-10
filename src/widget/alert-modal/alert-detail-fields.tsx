import { Component, Show } from 'solid-js'

import i18n from '../../i18n'
import { getAlertFrequencyText, getAlertTypeText, getAlertWindowText } from '../../i18n/trading'
import { AlertItem } from '../../types/types'

export const AlertDetailFields: Component<{ locale: string; alert: AlertItem }> = (props) => (
  <dl class="alert-detail-grid">
    <Show when={!!props.alert.symbol}>
      <dt>{i18n('alert_field_symbol', props.locale)}</dt>
      <dd>{props.alert.symbol}</dd>
    </Show>
    <dt>{i18n('alert_field_type', props.locale)}</dt>
    <dd>{getAlertTypeText(props.alert.type, props.locale)}</dd>
    <Show when={props.alert.price != null && Number.isFinite(props.alert.price)}>
      <dt>{i18n('alert_field_price', props.locale)}</dt>
      <dd>{String(props.alert.price)}</dd>
    </Show>
    <Show when={props.alert.window != null}>
      <dt>{i18n('alert_field_window', props.locale)}</dt>
      <dd>{getAlertWindowText(props.alert.window, props.locale)}</dd>
    </Show>
    <Show when={props.alert.percent != null}>
      <dt>{i18n('alert_field_percent', props.locale)}</dt>
      <dd>{`${props.alert.percent}%`}</dd>
    </Show>
    <dt>{i18n('alert_field_frequency', props.locale)}</dt>
    <dd>{getAlertFrequencyText(props.alert.frequency, props.locale)}</dd>
    <dt>{i18n('alert_field_remark', props.locale)}</dt>
    <dd>{props.alert.remark?.trim() ? props.alert.remark : '—'}</dd>
  </dl>
)
