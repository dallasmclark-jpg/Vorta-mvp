import type { ComponentProps } from "react";
import {
  AskVortaWorkspace as AskVortaWorkspaceBase,
  type AskVortaWorkspaceAnswer,
  type AskVortaWorkspaceMessage,
  type AskVortaWorkspaceTab,
} from "./AskVortaWorkspaceBase";
import { AskVortaSparePhotoDisclosures } from "./AskVortaSparePhotoDisclosures";

export type {
  AskVortaWorkspaceAnswer,
  AskVortaWorkspaceMessage,
  AskVortaWorkspaceTab,
};

type AskVortaWorkspaceProps = ComponentProps<typeof AskVortaWorkspaceBase>;

/**
 * Keep the established workspace implementation intact and add only the
 * spare-photo disclosure enhancement at the answer-rendering boundary.
 * This deliberately leaves the approved phone assistant untouched.
 */
export function AskVortaWorkspace(props: AskVortaWorkspaceProps): JSX.Element {
  const { renderAnswer } = props;

  return (
    <AskVortaWorkspaceBase
      {...props}
      renderAnswer={(answer: AskVortaWorkspaceAnswer) => (
        <>
          {renderAnswer(answer)}
          <AskVortaSparePhotoDisclosures answer={answer} />
        </>
      )}
    />
  );
}
