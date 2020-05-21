import { keyboardKey, SpacebarKey } from '@fluentui/keyboard-key';
import * as _ from 'lodash';

import { Accessibility } from '../../types';

/**
 * @description
 * Adds tabIndex='0' to 'trigger' slot, if it is not tabbable element and no tabIndex attribute provided.
 *
 * @specification
 * Adds attribute 'aria-disabled=true' to 'trigger' slot if 'disabled' property is true. Does not set the attribute otherwise.
 * Adds attribute 'role=dialog' to 'popup' slot if 'trapFocus' property is true. Sets the attribute to 'complementary' otherwise.
 * Adds attribute 'aria-modal=true' to 'popup' slot if 'trapFocus' property is true. Does not set the attribute otherwise.
 */
const popupBehavior: Accessibility<PopupBehaviorProps> = props => {
  const onAsArray = _.isArray(props.on) ? props.on : [props.on];
  const tabbableTriggerProps = props.tabbableTrigger
    ? { tabIndex: getAriaAttributeFromProps('tabIndex', props, 0) }
    : undefined;

  if (tabbableTriggerProps) {
    tabbableTriggerProps['aria-haspopup'] = 'true';

    if (process.env.NODE_ENV !== 'production') {
      // Override the default trigger's accessibility schema class.
      tabbableTriggerProps['data-aa-class'] = 'PopupButton';
    }
  }

  return {
    attributes: {
      trigger: {
        ...tabbableTriggerProps,
        'aria-disabled': props.disabled,
      },
      popup: {
        role: props.trapFocus ? 'dialog' : 'complementary',
        'aria-modal': props.trapFocus ? true : undefined,
      },
    },
    keyActions: {
      popup: {
        closeAndFocusTrigger: {
          keyCombinations: [{ keyCode: keyboardKey.Escape }],
        },
        preventScroll: {
          keyCombinations: props.isOpenedByRightClick &&
            _.includes(onAsArray, 'context') && [
              { keyCode: keyboardKey.ArrowDown },
              { keyCode: keyboardKey.ArrowUp },
              { keyCode: keyboardKey.PageDown },
              { keyCode: keyboardKey.PageUp },
              { keyCode: keyboardKey.Home },
              { keyCode: keyboardKey.End },
            ],
        },
      },
      trigger: {
        close: {
          keyCombinations: [{ keyCode: keyboardKey.Escape }],
        },
        toggle: {
          keyCombinations: _.includes(onAsArray, 'click') && [{ keyCode: keyboardKey.Enter }, { keyCode: SpacebarKey }],
        },
        open: {
          keyCombinations: _.includes(onAsArray, 'hover') &&
            !_.includes(onAsArray, 'context') && [{ keyCode: keyboardKey.Enter }, { keyCode: SpacebarKey }],
        },
      },
    },
  };
};

const isFocusable = propsData => {
  try {
    const { as, href, type } = propsData;
    return type === 'button' || type === 'input' || (type === 'a' && href !== undefined) || as === 'button';
  } catch {
    return false;
  }
};

const getAriaAttributeFromProps = (attributeName: string, props: any, defaultValue: number | string) => {
  if (!props.trigger) return undefined;
  if (props.trigger.props[attributeName]) {
    return props.trigger.props[attributeName];
  }
  const { as, href } = props.trigger.props;
  const { type } = props.trigger;
  if (isFocusable({ as, href, type })) {
    return undefined;
  }
  return defaultValue;
};

export default popupBehavior;

type PopupEvents = 'click' | 'hover' | 'focus' | 'context';
type RestrictedClickEvents = 'click' | 'focus';
type RestrictedHoverEvents = 'hover' | 'focus' | 'context';
type PopupEventsArray = RestrictedClickEvents[] | RestrictedHoverEvents[];

export type PopupBehaviorProps = {
  /** Indicates if focus should be trapped inside popup's container. */
  trapFocus?: boolean | object;
  /** Events triggering the popup. */
  on?: PopupEvents | PopupEventsArray;
  /** Indicates if popup's trigger is disabled. */
  disabled?: boolean;
  /** Element which triggers popup */
  trigger?: {
    props?: {
      /** Element type. */
      as?: string;
      href?: string;
      tabIndex?: string;
    };
    /** Element type. */
    type?: string;
  };
  /** Whether the trigger should be tabbable */
  tabbableTrigger?: boolean;
  /** Whether the popup was opened by right click */
  isOpenedByRightClick?: boolean;
};
