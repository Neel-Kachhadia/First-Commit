import { Amplify } from "aws-amplify";

const REGION =
  process.env.NEXT_PUBLIC_COGNITO_REGION || "ap-south-1";
const USER_POOL_ID =
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "ap-south-1_0QOuJhfKL";
const CLIENT_ID =
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "40cgpna82o9k2skf4cej7vhjr7";

/**
 * Call this to configure AWS Amplify Auth.
 * Safe to call multiple times.
 */
export function configureAmplify() {
  try {
    Amplify.configure(
      {
        Auth: {
          Cognito: {
            userPoolId: USER_POOL_ID,
            userPoolClientId: CLIENT_ID,
            signUpVerificationMethod: "code",
            loginWith: {
              email: true,
            },
          },
        },
      },
      { ssr: true }
    );
  } catch (err) {
    console.warn("[amplify-config] configuration note:", err);
  }
}

// Auto-run on module import in any environment (client or server)
configureAmplify();

