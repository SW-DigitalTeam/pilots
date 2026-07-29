/**
 * ActivityProvider registry — the shell's seam for pulling evidence out of an
 * activity. An activity emits a claim; the provider validates it and hands it
 * to the shell's transport. Arcade Arena calls `submit`; it does not know or
 * care what happens after.
 */
import {
  CAMERA_POSE_PROVIDER,
  validateCameraPoseClaim,
  type CameraPoseClaim,
} from "./evidence.js";

export interface ActivityProvider<Claim> {
  readonly id: string;
  /** Throws if the claim is not submittable. Returns the accepted claim. */
  submit(claim: Claim): Claim;
}

export type SubmitSink = (claim: CameraPoseClaim) => void;

/**
 * The concrete cameraPose provider. `sink` is where accepted, derived-only
 * claims go (network POST, local queue, etc.) — the privacy critic audits the
 * sink, and by construction only validated claims reach it.
 */
export class CameraPoseProvider implements ActivityProvider<CameraPoseClaim> {
  readonly id = CAMERA_POSE_PROVIDER;

  constructor(private readonly sink: SubmitSink) {}

  submit(claim: CameraPoseClaim): CameraPoseClaim {
    const result = validateCameraPoseClaim(claim);
    if (!result.ok) {
      throw new Error(`cameraPose claim rejected: ${result.errors.join("; ")}`);
    }
    this.sink(claim);
    return claim;
  }
}
