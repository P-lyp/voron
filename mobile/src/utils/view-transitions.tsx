import React, { ReactNode } from 'react';

export interface ViewTransitionProps {
  children?: ReactNode;
  name?: string;
  enter?: any;
  exit?: any;
  share?: any;
  update?: any;
  default?: any;
  onEnter?: any;
  onExit?: any;
  onShare?: any;
  onUpdate?: any;
}

/**
 * Universal ViewTransition component:
 * 1. If React.ViewTransition is available in runtime (React Canary / React 19), delegates directly to it.
 * 2. If React.ViewTransition is undefined (React 18 or stale Vite cache), gracefully renders children
 *    and attaches viewTransitionName so CSS recipes and browser animations still work.
 * 3. Never throws "Element type is invalid: got undefined".
 */
export const ViewTransition: React.FC<ViewTransitionProps> = (props) => {
  const NativeVT = (React as any).ViewTransition;
  if (NativeVT) {
    return <NativeVT {...props} />;
  }

  const { children, name } = props;
  if (name && React.isValidElement(children)) {
    const existingStyle = (children.props as any)?.style || {};
    return React.cloneElement(children as React.ReactElement<any>, {
      style: {
        ...existingStyle,
        viewTransitionName: name,
      },
    });
  }

  return <>{children}</>;
};

export function addTransitionType(type: string): void {
  if (typeof (React as any).addTransitionType === 'function') {
    (React as any).addTransitionType(type);
  }
}

export function startTransition(scope: () => void): void {
  // If native startViewTransition exists in browser and React does not handle it internally
  if (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !(React as any).ViewTransition
  ) {
    try {
      (document as any).startViewTransition(() => {
        React.startTransition(scope);
      });
      return;
    } catch {
      // Fallback to standard startTransition
    }
  }
  React.startTransition(scope);
}
