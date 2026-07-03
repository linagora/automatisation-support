import React, { type ReactNode } from "react";
import Footer from "@theme-original/DocItem/Footer";
import type FooterType from "@theme/DocItem/Footer";
import type { WrapperProps } from "@docusaurus/types";
import MarkdownLink from "@site/src/components/MarkdownLink";

type Props = WrapperProps<typeof FooterType>;

export default function FooterWrapper(props: Props): ReactNode {
  return (
    <>
      <div style={{ marginTop: "0.5rem" }}>
        <MarkdownLink />
      </div>
      <Footer {...props} />
    </>
  );
}
