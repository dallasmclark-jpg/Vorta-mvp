# Skills Matrix PM evidence audit

Date: 22 July 2026
Scope: Wrexham demo site, Core + Asset Skills Matrix preview

## Finding

The displayed PM evidence percentage is a strict engineer-task saturation metric, not a competence percentage.

For each workforce scope the preview currently divides the number of engineer/PM pairs with linked historical confirmation evidence by every possible engineer x PM pair across the site. Red Shift therefore has 6 evidenced pairs across 4 engineers and 149 PM tasks: 6 / 596 = 1.0%.

That result is mathematically correct for full workforce-task saturation, but the label `PM evidence coverage` can be misread as "Red Shift is only 1% competent". It does not mean that.

## Source-data audit

- 149 PM tasks are currently in the Wrexham site scope.
- 35 work orders with personnel confirmations are linked to a preventive-maintenance definition.
- 74 confirmed work orders are not linked to a PM definition.
- Of those 74 unlinked orders, 48 are corrective orders, 25 are inspection orders and 1 is an older corrective record.
- No additional genuine PM records can be recovered safely from the unlinked work orders without inventing relationships.

Team saturation under the existing strict denominator:

| Team | Members | Evidenced engineer/PM pairs | Possible pairs | Saturation |
| --- | ---: | ---: | ---: | ---: |
| Blue Shift | 4 | 8 | 596 | 1.3% |
| Day Team | 2 | 2 | 298 | 0.7% |
| Green Shift | 4 | 4 | 596 | 0.7% |
| Red Shift | 4 | 6 | 596 | 1.0% |
| Yellow Shift | 4 | 14 | 596 | 2.3% |

## Decision

Keep the historical records unchanged. Do not create artificial PM confirmations merely to improve a demo percentage.

The preview UI should:

1. Rename the headline metric to `Full engineer-task evidence saturation`.
2. Explain that it measures linked SAP history, not competence.
3. Show engineers in scope, PM tasks in scope and confirmed PM executions beside the percentage.
4. Treat sparse history as an evidence-quality warning rather than a zero-competence verdict.
5. Keep the existing capability score authoritative while the preview is evaluated.

A later production model may add a separate minimum-cover metric, but that should be introduced as an additional measure rather than silently changing the meaning of the current preview field.
