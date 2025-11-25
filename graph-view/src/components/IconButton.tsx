import clsx from "clsx";
import { FunctionComponent } from "react";

export function IconButton(props: {
    icon: FunctionComponent;
    enabled?: boolean;
    onClick?: React.MouseEventHandler;
    title?: string;
}) {
    const IconComponent = props.icon;
    const isEnabled = props.enabled === true || props.enabled === undefined;
    return (
        <div
            onClick={isEnabled ? props.onClick : undefined}
            title={props.title}
            className={clsx(
                "h-[28px] w-[28px] flex items-center justify-center flex-shrink-0 rounded-sm border border-editor-foreground/20 bg-editor-background shadow-sm transition-colors",
                {
                    "fill-editor-foreground hover:fill-editor-foreground/80 cursor-pointer":
                        isEnabled,
                    "fill-editor-foreground/40 opacity-70 cursor-not-allowed":
                        !isEnabled,
                },
            )}
        >
            <IconComponent />
        </div>
    );
}
