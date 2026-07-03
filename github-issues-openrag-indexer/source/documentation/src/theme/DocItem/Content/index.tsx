import React, { type ReactNode } from "react";
import Content from "@theme-original/DocItem/Content";
import type ContentType from "@theme/DocItem/Content";
import type { WrapperProps } from "@docusaurus/types";
import MarkdownLink from "@site/src/components/MarkdownLink";

type Props = WrapperProps<typeof ContentType>;

export default function ContentWrapper(props: Props): ReactNode {
  return (
    <>
      <div style={{ textAlign: "right", marginBottom: "0.5rem" }}>
        <MarkdownLink />
      </div>
      <Content {...props} />
    </>
  );
}
