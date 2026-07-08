import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, initials } from "@/lib/utils";

const avatarVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-accent-soft font-medium text-accent",
  {
    variants: {
      size: {
        sm: "size-6 text-[0.625rem]",
        md: "size-8 text-xs",
        lg: "size-10 text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  /** Display name or email — initials are derived from it. */
  name: string;
}

function Avatar({ className, size, name, ...props }: AvatarProps) {
  return (
    <span
      className={cn(avatarVariants({ size }), className)}
      title={name}
      {...props}
    >
      {initials(name)}
    </span>
  );
}

export { Avatar, avatarVariants };
