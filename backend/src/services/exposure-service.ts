import {
  grantRepository,
  type Grant,
} from "../store/grant-repository.js";

export interface ExposureResult {
  userId: string;
  currency: string;
  exposure: number;
  roots: Array<{
    grantId: string;
    label: string;
    residual: number;
    status: Grant["status"];
    executable: boolean;
  }>;
  calculatedAt: string;
}

export class ExposureService {
  async calculateExposure(
    userId: string
  ): Promise<ExposureResult> {
    const grants =
      await grantRepository.listUserGrants(userId);

    const roots = grants.filter(
      (grant) => !grant.parentGrantId
    );

    let exposure = 0;

    const rootDetails = roots.map((grant) => {
      const residual = Math.max(
        0,
        grant.limit - grant.consumed
      );

      const executable =
        grant.status === "ACTIVE" &&
        (!grant.expiresAt ||
          new Date(grant.expiresAt).getTime() >
            Date.now());

      if (executable) {
        exposure += residual;
      }

      return {
        grantId: grant.grantId,
        label: grant.label,
        residual,
        status: grant.status,
        executable,
      };
    });

    return {
      userId,
      currency: roots[0]?.currency ?? "INR",
      exposure,
      roots: rootDetails,
      calculatedAt:
        new Date().toISOString(),
    };
  }
}

export const exposureService =
  new ExposureService();
