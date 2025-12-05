import * as React from "react";

/**
 * Slot component - native implementation to replace @radix-ui/react-slot
 * Merges props and passes them to the child element when asChild is used
 */

interface SlotProps extends React.HTMLAttributes<HTMLElement> {
    children?: React.ReactNode;
}

function Slot({ children, ...props }: SlotProps) {
    if (React.isValidElement(children)) {
        const childProps = children.props as Record<string, unknown>;
        return React.cloneElement(children as React.ReactElement<any>, {
            ...props,
            ...childProps,
            className: mergeClassNames(props.className, childProps.className as string | undefined),
            style: { ...props.style, ...(childProps.style as React.CSSProperties | undefined) },
        });
    }

    if (React.Children.count(children) > 1) {
        React.Children.only(null); // This will throw
    }

    return null;
}

function mergeClassNames(...classNames: (string | undefined)[]) {
    return classNames.filter(Boolean).join(" ");
}

export { Slot };
