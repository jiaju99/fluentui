import {
  Accessibility,
  toolbarBehavior,
  ToolbarBehaviorProps,
  toggleButtonBehavior,
  IS_FOCUSABLE_ATTRIBUTE,
} from '@fluentui/accessibility';
import {
  getElementType,
  getFirstFocusable,
  useAccessibility,
  useStyles,
  useTelemetry,
  useUnhandledProps,
} from '@fluentui/react-bindings';
import { EventListener } from '@fluentui/react-component-event-listener';
import { Ref } from '@fluentui/react-component-ref';
import { MoreIcon } from '@fluentui/react-icons-northstar';
import * as customPropTypes from '@fluentui/react-proptypes';
import * as _ from 'lodash';
import * as PropTypes from 'prop-types';
import * as React from 'react';
// @ts-ignore
import { ThemeContext } from 'react-fela';

import {
  ComponentEventHandler,
  FluentComponentStaticProps,
  ProviderContextPrepared,
  ShorthandCollection,
  ShorthandValue,
  WithAsProp,
  withSafeTypeForAs,
} from '../../types';
import {
  childrenExist,
  createShorthandFactory,
  UIComponentProps,
  ContentComponentProps,
  ChildrenComponentProps,
  commonPropTypes,
  ColorComponentProps,
} from '../../utils';
import ToolbarCustomItem, { ToolbarCustomItemProps } from './ToolbarCustomItem';
import ToolbarDivider, { ToolbarDividerProps } from './ToolbarDivider';
import ToolbarItem, { ToolbarItemProps } from './ToolbarItem';
import ToolbarMenu, { ToolbarMenuProps } from './ToolbarMenu';
import ToolbarMenuDivider from './ToolbarMenuDivider';
import ToolbarMenuItem from './ToolbarMenuItem';
import ToolbarMenuRadioGroup, { ToolbarMenuRadioGroupProps } from './ToolbarMenuRadioGroup';
import ToolbarRadioGroup from './ToolbarRadioGroup';
import { ToolbarVariablesProvider } from './toolbarVariablesContext';

export type ToolbarItemShorthandKinds = {
  item: ToolbarItemProps;
  divider: ToolbarDividerProps;
  group: ToolbarMenuRadioGroupProps;
  toggle: ToolbarItemProps;
  custom: ToolbarCustomItemProps;
};

type PositionOffset = {
  vertical: number;
  horizontal: number;
};

const WAS_FOCUSABLE_ATTRIBUTE = 'data-was-focusable';

export interface ToolbarProps
  extends UIComponentProps,
    ContentComponentProps,
    ChildrenComponentProps,
    ColorComponentProps {
  /** Accessibility behavior if overridden by the user. */
  accessibility?: Accessibility<ToolbarBehaviorProps>;

  /** Shorthand array of props for Toolbar. */
  items?: ShorthandCollection<ToolbarItemProps, ToolbarItemShorthandKinds>;

  /**
   *  Automatically move overflow items to overflow menu.
   *  For automatic overflow to work correctly, toolbar items including overflowMenuItem
   *  must NOT change their size! If you need to change item's size, rerender the Toolbar.
   */
  overflow?: boolean;

  /** Indicates if the overflow menu is open. Only valid if `overflow` is enabled and regular items do not fit. */
  overflowOpen?: boolean;

  /**
   * Shorthand for the overflow item which is displayed when `overflow` is enabled and regular toolbar items do not fit.
   * Do not set any menu on this item, Toolbar overrides it.
   */
  overflowItem?: ShorthandValue<ToolbarItemProps>;

  /**
   * Called when overflow is recomputed (after render, update or window resize). Even if all items fit.
   * @param itemsVisible - number of items visible
   */
  onOverflow?: (itemsVisible: number) => void;

  /**
   * Event for request to change 'overflowOpen' value.
   * @param event - React's original SyntheticEvent.
   * @param data - All props and proposed value.
   */
  onOverflowOpenChange?: ComponentEventHandler<ToolbarProps>;

  /**
   * Callback to get items to be rendered in overflow menu.
   * Called when overflow menu is rendered opened.
   * @param startIndex - Index of the first item to be displayed in the overflow menu (the first item which does not fit the toolbar).
   */
  getOverflowItems?: (startIndex: number) => ToolbarItemProps['menu'];
}

export type ToolbarStylesProps = never;

export const toolbarClassName = 'ui-toolbar';

const Toolbar: React.FC<WithAsProp<ToolbarProps>> &
  FluentComponentStaticProps<ToolbarProps> & {
    CustomItem: typeof ToolbarCustomItem;
    Divider: typeof ToolbarDivider;
    Item: typeof ToolbarItem;
    Menu: typeof ToolbarMenu;
    MenuDivider: typeof ToolbarMenuDivider;
    MenuItem: typeof ToolbarMenuItem;
    MenuRadioGroup: typeof ToolbarMenuRadioGroup;
    RadioGroup: typeof ToolbarRadioGroup;
  } = props => {
  const context: ProviderContextPrepared = React.useContext(ThemeContext);
  const { setStart, setEnd } = useTelemetry(Toolbar.displayName, context.telemetry);
  setStart();

  const {
    accessibility,
    className,
    children,
    design,
    getOverflowItems,
    items,
    overflow,
    overflowItem,
    overflowOpen,
    styles,
    variables,
  } = props;

  const overflowContainerRef = React.useRef<HTMLDivElement>();
  const overflowItemRef = React.useRef<HTMLElement>();
  const offsetMeasureRef = React.useRef<HTMLDivElement>();
  const containerRef = React.useRef<HTMLElement>();

  // index of the last visible item in Toolbar, the rest goes to overflow menu
  const lastVisibleItemIndex = React.useRef<number>();
  const animationFrameId = React.useRef<number>();

  const getA11Props = useAccessibility(accessibility, {
    debugName: Toolbar.displayName,
    rtl: context.rtl,
  });
  const { classes } = useStyles<ToolbarStylesProps>(Toolbar.displayName, {
    className: toolbarClassName,
    mapPropsToInlineStyles: () => ({
      className,
      design,
      styles,
      variables,
    }),
    rtl: context.rtl,
  });

  const ElementType = getElementType(props);
  const unhandledProps = useUnhandledProps(Toolbar.handledProps, props);

  const hide = (el: HTMLElement) => {
    if (el.style.visibility === 'hidden') {
      return;
    }

    if (context.target.activeElement === el || el.contains(context.target.activeElement)) {
      if (containerRef.current) {
        const firstFocusableItem = getFirstFocusable(
          containerRef.current,
          containerRef.current.firstElementChild as HTMLElement,
        );

        if (firstFocusableItem) {
          firstFocusableItem.focus();
        }
      }
    }

    el.style.visibility = 'hidden';
    const wasFocusable = el.getAttribute(IS_FOCUSABLE_ATTRIBUTE);
    if (wasFocusable) {
      el.setAttribute(WAS_FOCUSABLE_ATTRIBUTE, wasFocusable);
    }
    el.setAttribute(IS_FOCUSABLE_ATTRIBUTE, 'false');
  };

  const show = (el: HTMLElement) => {
    if (el.style.visibility !== 'hidden') {
      return false;
    }

    el.style.visibility = null;
    const wasFocusable = el.getAttribute(WAS_FOCUSABLE_ATTRIBUTE);
    if (wasFocusable) {
      el.setAttribute(IS_FOCUSABLE_ATTRIBUTE, wasFocusable);
      el.removeAttribute(WAS_FOCUSABLE_ATTRIBUTE);
    } else {
      el.removeAttribute(IS_FOCUSABLE_ATTRIBUTE);
    }

    return true;
  };

  /**
   * Checks if `item` overflows a `container`.
   * TODO: check and fix all margin combination
   */
  const isItemOverflowing = (itemBoundingRect: ClientRect, containerBoundingRect: ClientRect) => {
    return itemBoundingRect.right > containerBoundingRect.right || itemBoundingRect.left < containerBoundingRect.left;
  };

  /**
   * Checks if `item` would collide with eventual position of `overflowItem`.
   */
  const wouldItemCollide = (
    $item: Element,
    itemBoundingRect: ClientRect,
    overflowItemBoundingRect: ClientRect,
    containerBoundingRect: ClientRect,
  ) => {
    const actualWindow: Window = context.target.defaultView;
    let wouldCollide;

    if (context.rtl) {
      const itemLeftMargin = parseFloat(actualWindow.getComputedStyle($item).marginLeft) || 0;
      wouldCollide =
        itemBoundingRect.left - overflowItemBoundingRect.width - itemLeftMargin < containerBoundingRect.left;

      // console.log('Collision [RTL]', {
      //   wouldCollide,
      //   'itemBoundingRect.left': itemBoundingRect.left,
      //   'overflowItemBoundingRect.width': overflowItemBoundingRect.width,
      //   itemRightMargin: itemLeftMargin,
      //   sum: itemBoundingRect.left - overflowItemBoundingRect.width - itemLeftMargin,
      //   'overflowContainerBoundingRect.left': containerBoundingRect.left,
      // })
    } else {
      const itemRightMargin = parseFloat(actualWindow.getComputedStyle($item).marginRight) || 0;
      wouldCollide =
        itemBoundingRect.right + overflowItemBoundingRect.width + itemRightMargin > containerBoundingRect.right;

      // console.log('Collision', {
      //   wouldCollide,
      //   'itemBoundingRect.right': itemBoundingRect.right,
      //   'overflowItemBoundingRect.width': overflowItemBoundingRect.width,
      //   itemRightMargin,
      //   sum: itemBoundingRect.right + overflowItemBoundingRect.width + itemRightMargin,
      //   'overflowContainerBoundingRect.right': containerBoundingRect.right,
      // })
    }

    return wouldCollide;
  };

  /**
   * Positions overflowItem next to lastVisible item
   * TODO: consider overflowItem margin
   */
  const setOverflowPosition = (
    $overflowItem: HTMLElement,
    $lastVisibleItem: HTMLElement | undefined,
    lastVisibleItemRect: ClientRect | undefined,
    containerBoundingRect: ClientRect,
    absolutePositioningOffset: PositionOffset,
  ) => {
    const actualWindow: Window = context.target.defaultView;

    if ($lastVisibleItem) {
      if (context.rtl) {
        const lastVisibleItemMarginLeft = parseFloat(actualWindow.getComputedStyle($lastVisibleItem).marginLeft) || 0;

        $overflowItem.style.right = `${containerBoundingRect.right -
          lastVisibleItemRect.left +
          lastVisibleItemMarginLeft +
          absolutePositioningOffset.horizontal}px`;
      } else {
        const lastVisibleItemRightMargin = parseFloat(actualWindow.getComputedStyle($lastVisibleItem).marginRight) || 0;

        $overflowItem.style.left = `${lastVisibleItemRect.right -
          containerBoundingRect.left +
          lastVisibleItemRightMargin +
          absolutePositioningOffset.horizontal}px`;
      }
    } else {
      // there is no last visible item -> position the overflow as the first item
      lastVisibleItemIndex.current = -1;
      if (context.rtl) {
        $overflowItem.style.right = `${absolutePositioningOffset.horizontal}px`;
      } else {
        $overflowItem.style.left = `${absolutePositioningOffset.horizontal}px`;
      }
    }
  };

  const hideOverflowItems = () => {
    const $overflowContainer = overflowContainerRef.current;
    const $overflowItem = overflowItemRef.current;
    const $offsetMeasure = offsetMeasureRef.current;
    if (!$overflowContainer || !$overflowItem || !$offsetMeasure) {
      return;
    }

    // workaround: when resizing window with popup opened the container contents scroll for some reason
    if (context.rtl) {
      $overflowContainer.scrollTo(Number.MAX_SAFE_INTEGER, 0);
    } else {
      $overflowContainer.scrollTo(0, 0);
    }

    const $items = $overflowContainer.children;

    const overflowContainerBoundingRect = $overflowContainer.getBoundingClientRect();
    const overflowItemBoundingRect = $overflowItem.getBoundingClientRect();
    const offsetMeasureBoundingRect = $offsetMeasure.getBoundingClientRect();

    // Absolute positioning offset
    // Overflow menu is absolutely positioned relative to root slot
    // If there is padding set on the root slot boundingClientRect computations use inner content box,
    // but absolute position is relative to root slot's PADDING box.
    // We compute absolute positioning offset
    // By measuring position of an offsetMeasure element absolutely positioned to 0,0.
    // TODO: replace by getComputedStyle('padding')
    const absolutePositioningOffset: PositionOffset = {
      horizontal: context.rtl
        ? offsetMeasureBoundingRect.right - overflowContainerBoundingRect.right
        : overflowContainerBoundingRect.left - offsetMeasureBoundingRect.left,
      vertical: overflowContainerBoundingRect.top - offsetMeasureBoundingRect.top,
    };

    let isOverflowing = false;
    let $lastVisibleItem;
    let lastVisibleItemRect;

    // check all items from the last one back
    _.forEachRight($items, ($item: HTMLElement, i: number) => {
      if ($item === $overflowItem) {
        return true;
      }

      const itemBoundingRect = $item.getBoundingClientRect();

      // if the item is out of the crop rectangle, hide it
      if (isItemOverflowing(itemBoundingRect, overflowContainerBoundingRect)) {
        isOverflowing = true;
        // console.log('Overflow', i, {
        //   item: [itemBoundingRect.left, itemBoundingRect.right],
        //   crop: [
        //     overflowContainerBoundingRect.left,
        //     overflowContainerBoundingRect.right,
        //     overflowContainerBoundingRect.width,
        //   ],
        //   container: $overflowContainer,
        // })
        hide($item);
        return true;
      }

      // if there is an overflow, check collision of remaining items with eventual overflow position
      if (
        isOverflowing &&
        !$lastVisibleItem &&
        wouldItemCollide($item, itemBoundingRect, overflowItemBoundingRect, overflowContainerBoundingRect)
      ) {
        hide($item);
        return true;
      }

      // Remember the last visible item
      if (!$lastVisibleItem) {
        $lastVisibleItem = $item;
        lastVisibleItemRect = itemBoundingRect;
        lastVisibleItemIndex.current = i;
      }

      return show($item); // exit the loop when first visible item is found
    });

    // if there is an overflow,  position and show overflow item, otherwise hide it
    if (isOverflowing || overflowOpen) {
      $overflowItem.style.position = 'absolute';
      setOverflowPosition(
        $overflowItem,
        $lastVisibleItem,
        lastVisibleItemRect,
        overflowContainerBoundingRect,
        absolutePositioningOffset,
      );
      show($overflowItem);
    } else {
      lastVisibleItemIndex.current = items.length - 1;
      hide($overflowItem);
    }

    _.invoke(props, 'onOverflow', lastVisibleItemIndex.current + 1);
  };

  const collectOverflowItems = (): ToolbarItemProps['menu'] => {
    return getOverflowItems
      ? getOverflowItems(lastVisibleItemIndex.current + 1)
      : items.slice(lastVisibleItemIndex.current + 1);
  };

  const getVisibleItems = () => {
    // console.log('allItems()', items)
    const end = overflowOpen ? lastVisibleItemIndex.current + 1 : items.length;
    // console.log('getVisibleItems()', items.slice(0, end))
    return items.slice(0, end);
  };

  const handleWindowResize = _.debounce((e: UIEvent) => {
    hideOverflowItems();

    if (overflowOpen) {
      _.invoke(props, 'onOverflowOpenChange', e, { ...props, overflowOpen: false });
    }
  }, 16);

  const renderItems = (items: ToolbarProps['items']) =>
    _.map(items, item => {
      const kind = _.get(item, 'kind', 'item');

      switch (kind) {
        case 'divider':
          return ToolbarDivider.create(item);
        case 'group':
          return ToolbarRadioGroup.create(item);
        case 'toggle':
          return ToolbarItem.create(item, {
            defaultProps: () => ({ accessibility: toggleButtonBehavior }),
          });
        case 'custom':
          return ToolbarCustomItem.create(item);
        default:
          return ToolbarItem.create(item);
      }
    });

  const renderOverflowItem = overflowItem => {
    return (
      <Ref innerRef={overflowItemRef}>
        {ToolbarItem.create(overflowItem, {
          defaultProps: () => ({
            icon: <MoreIcon outline />,
          }),
          overrideProps: {
            menu: {
              items: overflowOpen ? (collectOverflowItems() as ToolbarMenuProps['items']) : [],
              popper: { positionFixed: true },
            },
            menuOpen: overflowOpen,
            onMenuOpenChange: (e, { menuOpen }) => {
              _.invoke(props, 'onOverflowOpenChange', e, { ...props, overflowOpen: menuOpen });
            },
          },
        })}
      </Ref>
    );
  };

  React.useEffect(() => {
    const actualWindow: Window = context.target.defaultView;

    actualWindow.cancelAnimationFrame(animationFrameId.current);
    // Heads up! There are cases (like opening a portal and rendering the Toolbar there immediately) when rAF is necessary
    animationFrameId.current = actualWindow.requestAnimationFrame(() => {
      hideOverflowItems();
    });

    return () => {
      if (animationFrameId.current !== undefined) {
        context.target.defaultView.cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = undefined;
      }
    };
  });

  const element = overflow ? (
    <>
      <Ref innerRef={containerRef}>
        {getA11Props.unstable_wrapWithFocusZone(
          <ElementType {...getA11Props('root', { className: classes.root, ...unhandledProps })}>
            <div className={classes.overflowContainer} ref={overflowContainerRef}>
              <ToolbarVariablesProvider value={variables}>
                {childrenExist(children) ? children : renderItems(getVisibleItems())}
                {renderOverflowItem(overflowItem)}
              </ToolbarVariablesProvider>
            </div>
            <div className={classes.offsetMeasure} ref={offsetMeasureRef} />
          </ElementType>,
        )}
      </Ref>
      <EventListener listener={handleWindowResize} target={context.target.defaultView} type="resize" />
    </>
  ) : (
    <Ref innerRef={containerRef}>
      {getA11Props.unstable_wrapWithFocusZone(
        <ElementType {...getA11Props('root', { className: classes.root, ...unhandledProps })}>
          <ToolbarVariablesProvider value={variables}>
            {childrenExist(children) ? children : renderItems(items)}
          </ToolbarVariablesProvider>
        </ElementType>,
      )}
    </Ref>
  );
  setEnd();

  return element;
};

Toolbar.displayName = 'Toolbar';

Toolbar.propTypes = {
  ...commonPropTypes.createCommon(),
  items: customPropTypes.collectionShorthandWithKindProp(['divider', 'item', 'group', 'toggle', 'custom']),
  overflow: PropTypes.bool,
  overflowOpen: PropTypes.bool,
  overflowItem: customPropTypes.shorthandAllowingChildren,
  onOverflow: PropTypes.func,
  onOverflowOpenChange: PropTypes.func,
  getOverflowItems: PropTypes.func,
};
Toolbar.defaultProps = {
  accessibility: toolbarBehavior,
  items: [],
  overflowItem: {},
};
Toolbar.handledProps = Object.keys(Toolbar.propTypes) as any;

Toolbar.CustomItem = ToolbarCustomItem;
Toolbar.Divider = ToolbarDivider;
Toolbar.Item = ToolbarItem;
Toolbar.Menu = ToolbarMenu;
Toolbar.MenuDivider = ToolbarMenuDivider;
Toolbar.MenuItem = ToolbarMenuItem;
Toolbar.MenuRadioGroup = ToolbarMenuRadioGroup;
Toolbar.RadioGroup = ToolbarRadioGroup;

Toolbar.create = createShorthandFactory({ Component: Toolbar, mappedProp: 'content' });

/**
 * A Toolbar is a container for grouping a set of controls, often action controls (e.g. buttons) or input controls (e.g. checkboxes).
 *
 * @accessibility
 *  * Implements [ARIA Toolbar](https://www.w3.org/TR/wai-aria-practices-1.1/#toolbar) design pattern.
 * @accessibilityIssues
 * [Issue 988424: VoiceOver narrates selected for button in toolbar](https://bugs.chromium.org/p/chromium/issues/detail?id=988424)
 */
export default withSafeTypeForAs<typeof Toolbar, ToolbarProps>(Toolbar);
