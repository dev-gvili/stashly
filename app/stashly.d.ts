// configure node process.env variables
declare namespace NodeJS {
    interface ProcessEnv {
        // Social Auth Providers
        GITHUB_CLIENT_ID: string;
        GITHUB_CLIENT_SECRET: string;
        GOOGLE_CLIENT_ID: string;
        GOOGLE_CLIENT_SECRET: string;
        MICROSOFT_CLIENT_ID: string;
        MICROSOFT_CLIENT_SECRET: string;
        
        // Fly.io - Tigris storage service
        AWS_BUCKET_NAME?: string;
        AWS_ACCESS_KEY: string;
        AWS_SECRET_KEY: string;
        AWS_ENDPOINT_URL: string;
        AWS_REGION: string;

        // Prisma Postgres server 
        DATABASE_URL: string;

        // 
        SESSION_SECRET: string;
        BETTER_AUTH_SECRET: string;
        BASE_URL: string;
        EMAIL_SERVICE_URL: string;
        EMAIL_SERVICE_TOKEN: string;
        STRIPE_SECRET_KEY: string;
        STRIPE_WEBHOOK_SECRET: string;
    }
}
