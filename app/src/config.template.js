'use strict';

/**
 * ==============================================
 * MiroTalk SFU - Configuration File
 * ==============================================
 *
 * This file contains all configurable settings for the MiroTalk SFU application.
 * Environment variables can override most settings (see each section for details).
 *
 * Structure:
 * 1. Core System Configuration
 * 2. Server Settings
 * 3. Media Handling
 * 4. Security & Authentication
 * 5. API Configuration
 * 6. Third-Party Integrations
 * 7. UI/UX Customization
 * 8. Feature Flags
 * 9. Mediasoup (WebRTC) Settings
 */

const dotenv = require('dotenv').config();
const packageJson = require('../../package.json');
const os = require('os');
const fs = require('fs');
const splitChar = ',';

// ==============================================
// 1. Environment Detection & System Configuration
// ==============================================

const PLATFORM = os.platform();
const IS_DOCKER = fs.existsSync('/.dockerenv');
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const ANNOUNCED_IP = process.env.SFU_ANNOUNCED_IP || '';
const LISTEN_IP = process.env.SFU_LISTEN_IP || '0.0.0.0';
const IPv4 = getIPv4();

// ==============================================
// 2. WebRTC Port Configuration
// ==============================================

const RTC_MIN_PORT = parseInt(process.env.SFU_MIN_PORT) || 40000;
const RTC_MAX_PORT = parseInt(process.env.SFU_MAX_PORT) || 40100;
const NUM_CPUS = os.cpus().length;
const NUM_WORKERS = Math.min(process.env.SFU_NUM_WORKERS || NUM_CPUS, NUM_CPUS);

// ==============================================
// 3. FFmpeg Path Configuration
// ==============================================

const RTMP_FFMPEG_PATH = process.env.RTMP_FFMPEG_PATH || getFFmpegPath(PLATFORM);

// ==============================================
// Main Configuration Export
// ==============================================

module.exports = {
    // ==============================================
    // 1. Core System Configuration
    // ==============================================

    system: {
        /**
         * System Information
         * ------------------
         * - Hardware/OS details collected automatically
         * - Used for diagnostics and optimization
         */
        info: {
            os: {
                type: os.type(),
                release: os.release(),
                arch: os.arch(),
            },
            cpu: {
                cores: NUM_CPUS,
                model: os.cpus()[0].model,
            },
            memory: {
                total: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
            },
            isDocker: IS_DOCKER,
        },

        /**
         * Console Configuration
         * ---------------------
         * - timeZone: IANA timezone (e.g., 'Europe/Rome')
         * - debug: Enable debug logging in non-production
         * - colors: Colorized console output
         * - json: Log output in JSON format
         * - json_pretty: Pretty-print JSON logs
         */
        console: {
            timeZone: 'UTC',
            debug: ENVIRONMENT !== 'production',
            json: process.env.LOGS_JSON === 'true',
            json_pretty: process.env.LOGS_JSON_PRETTY === 'true',
            colors: process.env.LOGS_JSON === 'true' ? false : true,
        },

        /**
         * External Services Configuration
         * -------------------------------
         * - ip: Services to detect public IP address
         */
        services: {
            ip: ['http://api.ipify.org', 'http://ipinfo.io/ip', 'http://ifconfig.me/ip'],
        },
    },

    // ==============================================
    // 2. Server Configuration
    // ==============================================

    server: {
        /**
         * Host Configuration
         * ------------------
         * - hostUrl: Public URL (e.g., 'https://yourdomain.com')
         * - listen: IP and port to bind to
         */
        hostUrl: process.env.SERVER_HOST_URL || 'https://localhost:3010',
        listen: {
            ip: process.env.SERVER_LISTEN_IP || '0.0.0.0',
            port: process.env.SERVER_LISTEN_PORT || 3010,
        },

        /**
         * Security Settings
         * -----------------
         * - trustProxy: Trust X-Forwarded-* headers
         * - ssl: SSL certificate paths
         * - cors: Cross-origin resource sharing
         */
        trustProxy: process.env.TRUST_PROXY === 'true',
        ssl: {
            cert: process.env.SERVER_SSL_CERT || '../ssl/cert.pem',
            key: process.env.SERVER_SSL_KEY || '../ssl/key.pem',
        },
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST'],
        },
    },

    // ==============================================
    // 3. Media Handling Configuration
    // ==============================================

    media: {
        /**
         * Recording Configuration
         * =======================
         * Server side recording functionality.
         *
         * Core Settings:
         * ------------------------
         * - enabled        : Enable recording functionality
         * - uploadToS3     : Upload recording to AWS S3 bucket [true/false]
         * - endpoint       : Leave empty ('') to store recordings locally OR
         *   - Set to a valid URL (e.g., 'http://localhost:8080/') to:
         *      - Push recordings to a remote server
         *      - Store in cloud storage services
         *      - Send to processing pipelines
         * - dir            : Storage directory for recordings
         * - maxFileSize    : Maximum recording size (1GB default)
         *
         * Docker Note:
         * ------------
         * - When running in Docker, ensure the recording directory exists and is properly mounted:
         *   1. Create the directory (e.g., 'app/rec')
         *   2. Configure as volume in docker-compose.yml
         *   3. Set appropriate permissions
         *   4. Restart container after changes
         */
        recording: {
            enabled: process.env.RECORDING_ENABLED === 'true',
            uploadToS3: process.env.RECORDING_UPLOAD_TO_S3 === 'true',
            endpoint: process.env.RECORDING_ENDPOINT || '',
            dir: 'rec',
            maxFileSize: 1 * 1024 * 1024 * 1024, // 1GB
        },

        /**
         * RTMP Configuration
         * =================
         * Configures Real-Time Messaging Protocol (RTMP) for audio/video/data streaming.
         *
         * Core Settings
         * ------------
         * - enabled            : Enable/disable RTMP streaming (default: false)
         * - fromFile           : Enable local file streaming (default: true)
         * - fromUrl            : Enable URL streaming (default: true)
         * - fromStream         : Enable live stream input (default: true)
         * - maxStreams         : Maximum simultaneous streams (default: 1)
         * - useNodeMediaServer : Use NodeMediaServer instead of nginx-rtmp (default: true)
         * - server             : RTMP server URL (default: 'rtmp://localhost:1935')
         * - appName            : Application name (default: 'live')
         * - streamKey          : Optional authentication key (auto-generated UUID if empty)
         * - secret             : Must match NodeMediaServer's config.js (default: 'mirotalkRtmpSecret')
         * - apiSecret          : WebRTC→RTMP API secret (default: 'mirotalkRtmpApiSecret')
         * - expirationHours    : Stream URL expiry in hours (default: 4)
         * - dir                : Video storage directory (default: 'app/rtmp')
         * - ffmpegPath         : FFmpeg binary path (auto-detected)
         * - platform           : Current OS platform (auto-detected)
         *
         * Server Management
         * ----------------
         * NodeMediaServer (mirotalk/nms:latest):
         *   - Start: npm run nms-start
         *   - Stop:  npm run nms-stop
         *   - Logs:  npm run nms-logs
         *
         * NGINX-RTMP (mirotalk/rtmp:latest):
         *   - Start: npm run rtmp-start
         *   - Stop:  npm run rtmp-stop
         *   - Logs:  npm run rtmp-logs
         *
         * Implementation Notes:
         * --------------------
         * 1. For NodeMediaServer:
         *    - Mandatory values: appName (falls back to 'live'), streamKey (auto-generated)
         *    - URL format: rtmp://host:port/appName/streamKey?sign=expiration-token
         *
         * 2. Default Behavior:
         *    - If server URL is empty, uses localhost:1935
         *    - If no streamKey provided, generates UUIDv4
         *    - When useNodeMediaServer=true, generates signed URLs with expiration
         *
         * Requirements:
         * -------------
         * - RTMP server must be running
         * - Port 1935 must be accessible
         * - FFmpeg must be installed
         *
         * Documentation:
         * --------------
         * - https://docs.mirotalk.com/mirotalk-sfu/rtmp/
         */
        rtmp: {
            enabled: process.env.RTMP_ENABLED === 'true',
            fromFile: process.env.RTMP_FROM_FILE !== 'false',
            fromUrl: process.env.RTMP_FROM_URL !== 'false',
            fromStream: process.env.RTMP_FROM_STREAM !== 'false',
            maxStreams: parseInt(process.env.RTMP_MAX_STREAMS) || 1,
            useNodeMediaServer: process.env.RTMP_USE_NODE_MEDIA_SERVER !== 'false',
            server: process.env.RTMP_SERVER || 'rtmp://localhost:1935',
            appName: process.env.RTMP_APP_NAME || 'live',
            streamKey: process.env.RTMP_STREAM_KEY || '',
            secret: process.env.RTMP_SECRET || 'mirotalkRtmpSecret',
            apiSecret: process.env.RTMP_API_SECRET || 'mirotalkRtmpApiSecret',
            expirationHours: parseInt(process.env.RTMP_EXPIRATION_HOURS) || 4,
            dir: 'rtmp',
            ffmpegPath: RTMP_FFMPEG_PATH,
            platform: PLATFORM,
        },
    },

    // ==============================================
    // 4. Security & Authentication
    // ==============================================

    security: {
        /**
         * IP Whitelisting
         * ------------------------
         * - enabled: Restrict access to specified IPs
         * - allowedIPs: Array of permitted IP addresses
         */
        middleware: {
            IpWhitelist: {
                enabled: process.env.IP_WHITELIST_ENABLED === 'true',
                allowedIPs: process.env.IP_WHITELIST_ALLOWED
                    ? process.env.IP_WHITELIST_ALLOWED.split(splitChar)
                          .map((ip) => ip.trim())
                          .filter((ip) => ip !== '')
                    : ['127.0.0.1', '::1'],
            },
        },

        /**
         * JWT Configuration
         * ------------------------
         * - key: Secret for JWT signing
         * - exp: Token expiration time
         */
        jwt: {
            key: process.env.JWT_SECRET || 'mirotalksfu_jwt_secret',
            exp: process.env.JWT_EXPIRATION || '1h',
        },

        /**
         * OpenID Connect (OIDC) Authentication Configuration
         * =================================================
         * Configures authentication using OpenID Connect (OIDC), allowing integration with
         * identity providers like Auth0, Okta, Keycloak, etc.
         *
         * Structure:
         * - enabled                                : Master switch for OIDC authentication
         * - baseURLDynamic                         : Whether to dynamically resolve base URL
         *   allow_rooms_creation_for_auth_users    : Allow all authenticated users via OIDC to create their own rooms
         * - peer_name                              : Controls which user attributes to enforce/request
         * - config                                 : Core OIDC provider settings
         *
         * Core Settings:
         * - issuerBaseURL      : Provider's discovery endpoint (e.g., https://your-tenant.auth0.com)
         * - baseURL            : Your application's base URL
         * - clientID           : Client identifier issued by provider
         * - clientSecret       : Client secret issued by provider
         * - secret             : Application session secret
         * - authRequired       : Whether all routes require authentication
         * - auth0Logout        : Whether to use provider's logout endpoint
         * - authorizationParams: OAuth/OIDC flow parameters including:
         *   - response_type    : OAuth response type ('code' for Authorization Code Flow)
         *   - scope            : Requested claims (openid, profile, email)
         * - routes             : Endpoint path configuration for:
         *   - callback         : OAuth callback handler path
         *   - login            : Custom login path (false to disable)
         *   - logout           : Custom logout path
         *
         */
        oidc: {
            enabled: process.env.OIDC_ENABLED === 'true',
            baseURLDynamic: false, // Set true if your app has dynamic base URLs

            // ==================================================================================================
            allow_rooms_creation_for_auth_users: process.env.OIDC_ALLOW_ROOMS_CREATION_FOR_AUTH_USERS !== 'false',
            // ==================================================================================================

            // User identity requirements
            peer_name: {
                force: process.env.OIDC_USERNAME_FORCE !== 'false', // Forces the username to match the OIDC email or name. If true, the user won't be able to change their name when joining a room
                email: process.env.OIDC_USERNAME_AS_EMAIL !== 'false', // Uses the OIDC email as the username.
                name: process.env.OIDC_USERNAME_AS_NAME === 'true', // Uses the OIDC name as the username
            },

            // Provider configuration
            config: {
                // Required provider settings
                issuerBaseURL: process.env.OIDC_ISSUER || 'https://server.example.com',
                baseURL: process.env.OIDC_BASE_URL || `http://localhost:${process.env.PORT || 3010}`,
                clientID: process.env.OIDC_CLIENT_ID || 'clientID',
                clientSecret: process.env.OIDC_CLIENT_SECRET || 'clientSecret',

                // Session configuration
                secret: process.env.OIDC_SECRET || 'mirotalksfu-oidc-secret',
                authRequired: process.env.OIDC_AUTH_REQUIRED === 'true', // Whether all routes require authentication
                auth0Logout: process.env.OIDC_AUTH_LOGOUT !== 'false', // Use provider's logout endpoint

                // OAuth/OIDC flow parameters
                authorizationParams: {
                    response_type: 'code', // Use authorization code flow
                    scope: 'openid profile email', // Request standard claims
                },

                // Route customization
                routes: {
                    callback: '/auth/callback', // OAuth callback path
                    login: false, // Disable default login route
                    logout: '/logout', // Custom logout path
                },
            },
        },

        /**
         * Host Protection Configuration
         * ============================
         * Controls access to host-level functionality and room management.
         *
         * Authentication Methods:
         * ----------------------
         * - Local users (defined in config or via HOST_USERS env variable)
         * - API/database validation (users_from_db=true)
         *
         * Core Settings:
         * --------------
         * - protected      : Enable/disable host protection globally
         * - user_auth      : Require user authentication for host access
         * - users_from_db  : Fetch users from API/database instead of local config
         *
         * API Integration:
         * ---------------
         * - users_api_secret_key    : Secret key for API authentication
         * - users_api_endpoint      : Endpoint to validate user credentials
         * - users_api_room_allowed  : Endpoint to check if user can access a room
         * - users_api_rooms_allowed : Endpoint to get allowed rooms for a user
         * - api_room_exists         : Endpoint to verify if a room exists
         *
         * Local User Configuration:
         * ------------------------
         * - users: Array of authorized users (used if users_from_db=false)
         *   - Define via HOST_USERS env variable:
         *     HOST_USERS=username:password:displayname:room1,room2|username2:password2:displayname2:*
         *     (Each user separated by '|', fields by ':', allowed_rooms comma-separated or '*' for all)
         *   - If HOST_USERS is not set, falls back to DEFAULT_USERNAME, DEFAULT_PASSWORD, etc.
         *   - Fields:
         *     - username      : Login username
         *     - password      : Login password
         *     - displayname   : User's display name
         *     - allowed_rooms : List of rooms user can access ('*' for all)
         *
         * Presenter Management:
         * --------------------
         * - list        : Array of usernames who can be presenters
         * - join_first  : First joiner becomes presenter (default: true)
         *
         * Documentation:
         * -------------
         * https://docs.mirotalk.com/mirotalk-sfu/host-protection/
         */
        host: {
            protected: process.env.HOST_PROTECTED === 'true',
            user_auth: process.env.HOST_USER_AUTH === 'true',

            users_from_db: process.env.HOST_USERS_FROM_DB === 'true',
            users_api_secret_key: process.env.USERS_API_SECRET || 'mirotalkweb_default_secret',
            users_api_endpoint: process.env.USERS_API_ENDPOINT || 'http://localhost:9000/api/v1/user/isAuth', // 'https://webrtc.mirotalk.com/api/v1/user/isAuth'
            users_api_room_allowed:
                process.env.USERS_ROOM_ALLOWED_ENDPOINT || 'http://localhost:9000/api/v1/user/isRoomAllowed', // 'https://webrtc.mirotalk.com/api/v1/user/isRoomAllowed'
            users_api_rooms_allowed:
                process.env.USERS_ROOMS_ALLOWED_ENDPOINT || 'http://localhost:9000/api/v1/user/roomsAllowed', // 'https://webrtc.mirotalk.com/api/v1/user/roomsAllowed'
            api_room_exists: process.env.ROOM_EXISTS_ENDPOINT || 'http://localhost:9000/api/v1/room/exists', // 'https://webrtc.mirotalk.com//api/v1/room/exists'

            users: process.env.HOST_USERS
                ? process.env.HOST_USERS.split('|').map((userStr) => {
                      const [username, password, displayname, allowedRoomsStr] = userStr.split(':');
                      return {
                          username: username || '',
                          password: password || '',
                          displayname: displayname || '',
                          allowed_rooms: allowedRoomsStr
                              ? allowedRoomsStr
                                    .split(',')
                                    .map((room) => room.trim())
                                    .filter((room) => room !== '')
                              : ['*'],
                      };
                  })
                : [
                      {
                          username: 'username',
                          password: 'password',
                          displayname: 'username displayname',
                          allowed_rooms: ['*'],
                      },
                      {
                          username: 'username2',
                          password: 'password2',
                          displayname: 'username2 displayname',
                          allowed_rooms: ['room1', 'room2'],
                      },
                      {
                          username: 'username3',
                          password: 'password3',
                          displayname: 'username3 displayname',
                      },
                      //...
                  ],

            presenters: {
                list: process.env.PRESENTERS
                    ? process.env.PRESENTERS.split(splitChar)
                          .map((presenter) => presenter.trim())
                          .filter((presenter) => presenter !== '')
                    : ['Miroslav Pejic', 'miroslav.pejic.85@gmail.com'],
                join_first: process.env.PRESENTER_JOIN_FIRST !== 'false',
            },
        },
    },

    // ==============================================
    // 5. API Configuration
    // ==============================================

    /**
     * API Security & Endpoint Configuration
     * ====================================
     * Controls access to the SFU's API endpoints and integration settings.
     *
     * Security Settings:
     * -----------------
     * - keySecret : Authentication secret for API requests
     *               (Always override default in production)
     *
     * Endpoint Control:
     * -----------------
     * - stats      : Enable/disable system statistics endpoint [true/false] (default: true)
     * - meetings   : Enable/disable meetings list endpoint [true/false] (default: true)
     * - meeting    : Enable/disable single meeting operations [true/false] (default: true)
     * - join       : Enable/disable meeting join endpoint [true/false] (default: true)
     * - token      : Enable/disable token generation endpoint [true/false] (default: false)
     * - slack      : Enable/disable Slack webhook integration [true/false] (default: true)
     * - mattermost : Enable/disable Mattermost webhook integration [true/false] (default: true)
     *
     * API Documentation:
     * ------------------
     * - Complete API reference: https://docs.mirotalk.com/mirotalk-sfu/api/
     * - Webhook setup: See integration guides for Slack/Mattermost
     */
    api: {
        keySecret: process.env.API_KEY_SECRET || 'mirotalksfu_default_secret',
        allowed: {
            stats: process.env.API_ALLOW_STATS !== 'false',
            meetings: process.env.API_ALLOW_MEETINGS === 'true',
            meeting: process.env.API_ALLOW_MEETING !== 'false',
            join: process.env.API_ALLOW_JOIN !== 'false',
            token: process.env.API_ALLOW_TOKEN === 'true',
            slack: process.env.API_ALLOW_SLACK !== 'false',
            mattermost: process.env.API_ALLOW_MATTERMOST !== 'false',
        },
    },

    // ==============================================
    // 6. Third-Party Integrations
    // ==============================================

    integrations: {
        /**
         * ChatGPT Integration Configuration
         * ================================
         * OpenAI API integration for AI-powered chat functionality
         *
         * Setup Instructions:
         * ------------------
         * 1. Go to https://platform.openai.com/
         * 2. Create your OpenAI account
         * 3. Generate your API key at https://platform.openai.com/account/api-keys
         *
         * Core Settings:
         * -------------
         * - enabled    : Enable/disable ChatGPT integration [true/false] (default: false)
         * - basePath   : OpenAI API endpoint (default: 'https://api.openai.com/v1/')
         * - apiKey     : OpenAI API secret key (ALWAYS store in .env)
         * - model      : GPT model version (default: 'gpt-3.5-turbo')
         *
         * Advanced Settings:
         * -----------------
         * - max_tokens: Maximum response length (default: 1024 tokens)
         * - temperature: Creativity control (0=strict, 1=creative) (default: 0)
         *
         * Usage Example:
         * -------------
         * 1. Supported Models:
         *    - gpt-3.5-turbo (recommended)
         *    - gpt-4
         *    - gpt-4-turbo
         *    - ...
         *
         * 2. Temperature Guide:
         *    - 0.0: Factual responses
         *    - 0.7: Balanced
         *    - 1.0: Maximum creativity
         */
        chatGPT: {
            enabled: process.env.CHATGPT_ENABLED === 'true',
            basePath: process.env.CHATGPT_BASE_PATH || 'https://api.openai.com/v1/',
            apiKey: process.env.CHATGPT_API_KEY || '',
            model: process.env.CHATGPT_MODEL || 'gpt-3.5-turbo',
            max_tokens: parseInt(process.env.CHATGPT_MAX_TOKENS) || 1024,
            temperature: parseInt(process.env.CHATGPT_TEMPERATURE) || 0.7,
        },

        /**
         * DeepDeek Integration Configuration
         * ================================
         * DeepDeek API integration for AI-powered chat functionality
         *
         * Setup Instructions:
         * ------------------
         * 1. Go to https://deepseek.com/
         * 2. Create your DeepDeek account
         * 3. Generate your API key at https://deepseek.com/account/api-keys
         *
         * Core Settings:
         * -------------
         * - enabled    : Enable/disable DeepDeek integration [true/false] (default: false)
         * - basePath   : DeepDeek API endpoint (default: 'https://api.deepseek.com/v1/')
         * - apiKey     : DeepDeek API secret key (ALWAYS store in .env)
         * - model      : DeepDeek model version (default: 'deepdeek-chat')
         *
         * Advanced Settings:
         * -----------------
         * - max_tokens: Maximum response length (default: 1024 tokens)
         * - temperature: Creativity control (0=strict, 1=creative) (default: 0)
         *
         * Usage Example:
         * -------------
         * 1. Supported Models:
         *  - deepseek-chat (recommended)
         *  - deepseek-coder
         *  - deepseek-math
         *  - deepseek-llm
         *  - ...
         *
         * 2. Temperature Guide:
         *  - 0.0: Factual responses
         *  - 0.7: Balanced
         *  - 1.0: Maximum creativity
         *
         */
        deepSeek: {
            enabled: process.env.DEEP_SEEK_ENABLED === 'true',
            basePath: process.env.DEEP_SEEK_BASE_PATH || 'https://api.deepseek.com/v1/',
            apiKey: process.env.DEEP_SEEK_API_KEY || '',
            model: process.env.DEEP_SEEK_MODEL || 'deepseek-chat',
            max_tokens: parseInt(process.env.DEEP_SEEK_MAX_TOKENS) || 1024,
            temperature: parseInt(process.env.DEEP_SEEK_TEMPERATURE) || 0.7,
        },

        /**
         * HeyGen Video AI Configuration
         * ============================
         * AI-powered avatar streaming integration
         *
         * Setup Instructions:
         * ------------------
         * 1. Go to https://app.heygen.com
         * 2. Create your HeyGen account
         * 3. Generate your API key at https://app.heygen.com/settings?nav=API
         *
         * Core Settings:
         * -------------
         * - enabled    : Enable/disable Video AI [true/false] (default: false)
         * - basePath   : HeyGen API endpoint (default: 'https://api.heygen.com')
         * - apiKey     : From HeyGen account (ALWAYS store in .env)
         *
         * AI Behavior:
         * -----------
         * - systemLimit: Personality/behavior instructions for the AI avatar
         *                (default: Streaming avatar instructions for MiroTalk SFU)
         */
        videoAI: {
            enabled: process.env.VIDEOAI_ENABLED === 'true',
            basePath: 'https://api.heygen.com',
            apiKey: process.env.VIDEOAI_API_KEY || '',
            systemLimit: process.env.VIDEOAI_SYSTEM_LIMIT || 'You are a streaming avatar from Kremlevka...',
        },

        /**
         * Email Notification Configuration
         * ===============================
         * SMTP settings for system alerts and notifications
         *
         * Core Settings:
         * -------------
         * - alert      : Enable/disable email alerts [true/false] (default: false)
         * - host       : SMTP server address (default: 'smtp.gmail.com')
         * - port       : SMTP port (default: 587 for TLS)
         * - username   : SMTP auth username
         * - password   : SMTP auth password (store ONLY in .env)
         * - from       : Sender email address (default: same as username)
         * - sendTo     : Recipient email for alerts
         *
         * Common Providers:
         * ----------------
         * Gmail:
         * - host: smtp.gmail.com
         * - port: 587
         *
         * Office365:
         * - host: smtp.office365.com
         * - port: 587
         *
         * SendGrid:
         * - host: smtp.sendgrid.net
         * - port: 587
         */
        email: {
            alert: process.env.EMAIL_ALERTS_ENABLED === 'true',
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT) || 587,
            username: process.env.EMAIL_USERNAME || 'your_username',
            password: process.env.EMAIL_PASSWORD || 'your_password',
            from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
            sendTo: process.env.EMAIL_SEND_TO || 'sfu.mirotalk@gmail.com',
        },

        /**
         * Slack Integration Configuration
         * ==============================
         * Settings for Slack slash commands and interactivity
         *
         * Setup Instructions:
         * ------------------
         * 1. Create a Slack app at https://api.slack.com/apps
         * 2. Under "Basic Information" → "App Credentials":
         *    - Copy the Signing Secret
         * 3. Enable "Interactivity & Shortcuts" and "Slash Commands"
         * 4. Set Request URL to: https://your-domain.com/slack/commands
         *
         * Core Settings:
         * -------------
         * - enabled         : Enable/disable Slack integration [true/false] (default: false)
         * - signingSecret   : From Slack app credentials (store ONLY in .env)
         *
         */
        slack: {
            enabled: process.env.SLACK_ENABLED === 'true',
            signingSecret: process.env.SLACK_SIGNING_SECRET || '',
        },

        /**
         * Mattermost Integration Configuration
         * ===================================
         * Settings for Mattermost slash commands and bot integration
         *
         * Setup Instructions:
         * ------------------
         * 1. Go to Mattermost System Console → Integrations → Bot Accounts
         * 2. Create a new bot account and copy:
         *    - Server URL (e.g., 'https://chat.yourdomain.com')
         *    - Access Token
         * 3. For slash commands:
         *    - Navigate to Integrations → Slash Commands
         *    - Set Command: '/sfu'
         *    - Set Request URL: 'https://your-sfu-server.com/mattermost/commands'
         *
         * Core Settings:
         * -------------
         * - enabled      : Enable/disable integration [true/false] (default: false)
         * - serverUrl    : Mattermost server URL (include protocol)
         * - token        : Bot account access token (most secure option)
         * - OR
         * - username     : Legacy auth username (less secure)
         * - password     : Legacy auth password (deprecated)
         *
         * Command Configuration:
         * ---------------------
         * - commands     : Slash command definitions:
         *   - name       : Command trigger (e.g., '/sfu')
         *   - message    : Default response template
         *
         */
        mattermost: {
            enabled: process.env.MATTERMOST_ENABLED === 'true',
            serverUrl: process.env.MATTERMOST_SERVER_URL || '',
            username: process.env.MATTERMOST_USERNAME || '',
            password: process.env.MATTERMOST_PASSWORD || '',
            token: process.env.MATTERMOST_TOKEN || '',
            commands: [
                {
                    name: process.env.MATTERMOST_COMMAND_NAME || '/sfu',
                    message: process.env.MATTERMOST_DEFAULT_MESSAGE || 'Here is your meeting room:',
                },
            ],
            texts: [
                {
                    name: process.env.MATTERMOST_COMMAND_NAME || '/sfu',
                    message: process.env.MATTERMOST_DEFAULT_MESSAGE || 'Here is your meeting room:',
                },
            ],
        },

        /**
         * Discord Integration Configuration
         * ================================
         * Settings for Discord bot and slash commands integration
         *
         * Setup Instructions:
         * ------------------
         * 1. Create a Discord application at https://discord.com/developers/applications
         * 2. Navigate to "Bot" section and:
         *    - Click "Add Bot"
         *    - Copy the bot token (DISCORD_TOKEN)
         * 3. Under "OAuth2 → URL Generator":
         *    - Select "bot" and "applications.commands" scopes
         *    - Select required permissions (see below)
         * 4. Invite bot to your server using generated URL
         *
         * Core Settings:
         * -------------
         * - enabled        : Enable/disable Discord bot [true/false] (default: false)
         * - token          : Bot token from Discord Developer Portal (store in .env)
         *
         * Command Configuration:
         * ---------------------
         * - commands       : Slash command definitions:
         *   - name         : Command trigger (e.g., '/sfu')
         *   - message      : Response template
         *   - baseUrl      : Meeting room base URL
         *
         */
        discord: {
            enabled: process.env.DISCORD_ENABLED === 'true',
            token: process.env.DISCORD_TOKEN || '',
            commands: [
                {
                    name: process.env.DISCORD_COMMAND_NAME || '/sfu',
                    message: process.env.DISCORD_DEFAULT_MESSAGE || 'Here is your SFU meeting room:',
                    baseUrl: process.env.DISCORD_BASE_URL || 'https://sfu.mirotalk.com/join/',
                },
            ],
        },

        /**
         * Ngrok Tunnel Configuration
         * =========================
         * Secure tunneling for local development and testing
         *
         * Setup Instructions:
         * ------------------
         * 1. Sign up at https://dashboard.ngrok.com/signup
         * 2. Get your auth token from:
         *    https://dashboard.ngrok.com/get-started/your-authtoken
         * 3. For reserved domains/subdomains:
         *    - Upgrade to paid plan if needed
         *    - Reserve at https://dashboard.ngrok.com/cloud-edge/domains
         *
         * Core Settings:
         * -------------
         * - enabled      : Enable/disable Ngrok tunneling [true/false] (default: false)
         * - authToken    : Your Ngrok authentication token (from dashboard)
         */
        ngrok: {
            enabled: process.env.NGROK_ENABLED === 'true',
            authToken: process.env.NGROK_AUTH_TOKEN || '',
        },

        /**
         * Sentry Error Tracking Configuration
         * ==================================
         * Real-time error monitoring and performance tracking
         *
         * Setup Instructions:
         * ------------------
         * 1. Create a project at https://sentry.io/signup/
         * 2. Get your DSN from:
         *    Project Settings → Client Keys (DSN)
         * 3. Configure alert rules and integrations as needed
         *
         * Core Settings:
         * -------------
         * enabled              : Enable/disable Sentry [true/false] (default: false)
         * logLevels            : Array of log levels to capture (default: ['error'])
         * DSN                  : Data Source Name (from Sentry dashboard)
         * tracesSampleRate     : Percentage of transactions to capture (0.0-1.0)
         *
         * Performance Tuning:
         * ------------------
         * - Production         : 0.1-0.2 (10-20% of transactions)
         * - Staging            : 0.5-1.0
         * - Development        : 0.0 (disable performance tracking)
         *
         */
        sentry: {
            enabled: process.env.SENTRY_ENABLED === 'true',
            logLevels: process.env.SENTRY_LOG_LEVELS
                ? process.env.SENTRY_LOG_LEVELS.split(splitChar).map((level) => level.trim())
                : ['error'],
            DSN: process.env.SENTRY_DSN || '',
            tracesSampleRate: Math.min(Math.max(parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.5, 0), 1),
        },

        /**
         * Webhook Configuration Settings
         * =============================
         * Controls the webhook notification system for sending event data to external services.
         *
         * Core Settings:
         * ---------------------
         * - enabled: Turns webhook notifications on/off
         * - url: The endpoint URL where webhook payloads will be sent in JSON format
         *
         * Implementation Guide:
         * --------------------
         * - For complete implementation examples, refer to:
         *      - Project demo: /mirotalksfu/webhook/ folder
         */
        webhook: {
            enabled: process.env.WEBHOOK_ENABLED === 'true',
            url: process.env.WEBHOOK_URL || 'https://your-site.com/webhook-endpoint',
        },

        /**
         * IP Geolocation Service Configuration
         * ===================================
         * Enables lookup of geographical information based on IP addresses using the GeoJS.io API.
         *
         * Core Settings:
         * ---------------------
         * - enabled: Enable/disable the IP lookup functionality [true/false] default false
         *
         * Service Details:
         * --------------
         * - Uses GeoJS.io free API service (https://www.geojs.io/)
         * - Returns JSON data containing:
         *   - Country, region, city
         *   - Latitude/longitude
         *   - Timezone and organization
         * - Rate limits: 60 requests/minute (free tier)
         */
        IPLookup: {
            enabled: process.env.IP_LOOKUP_ENABLED === 'true',
            getEndpoint(ip) {
                return `https://get.geojs.io/v1/ip/geo/${ip}.json`;
            },
        },

        /**
         * AWS S3 Storage Configuration
         * ===========================
         * Enables cloud file storage using Amazon Simple Storage Service (S3).
         *
         * Core Settings:
         * --------------
         * - enabled: Enable/disable AWS S3 integration [true/false]
         *
         * Service Setup:
         * -------------
         * 1. Create an S3 Bucket:
         *    - Sign in to AWS Management Console
         *    - Navigate to S3 service
         *    - Click "Create bucket"
         *    - Choose unique name (e.g., 'mirotalk')
         *    - Select region (must match AWS_REGION in config)
         *    - Enable desired settings (versioning, logging, etc.)
         *
         * 2. Get Security Credentials:
         *    - Create IAM user with programmatic access
         *    - Attach 'AmazonS3FullAccess' policy (or custom minimal policy)
         *    - Save Access Key ID and Secret Access Key
         *
         * 3. Configure CORS (for direct uploads):
         *    [
         *      {
         *        "AllowedHeaders": ["*"],
         *        "AllowedMethods": ["PUT", "POST"],
         *        "AllowedOrigins": ["*"],
         *        "ExposeHeaders": []
         *      }
         *    ]
         *
         * Technical Details:
         * -----------------
         * - Default region: us-east-2 (Ohio)
         * - Direct upload uses presigned URLs (expire after 1 hour by default)
         * - Recommended permissions for direct upload:
         *   - s3:PutObject
         *   - s3:GetObject
         *   - s3:DeleteObject
         */
        aws: {
            enabled: process.env.AWS_S3_ENABLED === 'true',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key-id',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-access-key',
            region: process.env.AWS_REGION || 'us-east-2',
            bucket: process.env.AWS_S3_BUCKET || 'mirotalk',
        },
    },

    // ==============================================
    // 7. UI/UX Customization
    // ==============================================

    ui: {
        /**
         * Branding & Appearance Configuration
         * -----------------------------------
         * Controls all aspects of the application's visual identity, content, and metadata.
         * Supports environment variable overrides for deployment-specific customization.
         *
         * ==============================================
         * LICENSE REQUIRED:
         * ==============================================
         * - https://codecanyon.net/item/mirotalk-sfu-webrtc-realtime-video-conferences/40769970
         */
        rooms: {
            /**
             * Room Display Settings
             * ---------------------
             * - showActive: Show active rooms in the UI (default: false)
             *   https://sfu.mirotalk.com/activeRooms
             */
            showActive: process.env.SHOW_ACTIVE_ROOMS === 'false',
        },
        brand: {
            /**
             * Application Branding
             * --------------------
             * Core application identity and user interface text elements.
             *
             * Note:
             * Set BRAND_HTML_INJECTION to 'false' to disable HTML injection.
             * This allows for static branding in the public/views folder, without dynamic content injection.
             */
            htmlInjection: process.env.BRAND_HTML_INJECTION !== 'true',

            app: {
                language: process.env.UI_LANGUAGE || 'ru',
                name: process.env.APP_NAME || 'Kremlevka',
                title:
                    process.env.APP_TITLE ||
                    '<h1>Кремлёвка</h1> Специальная связь.',
                description:
                    process.env.APP_DESCRIPTION ||
                    'Start your next video call with a single click. No download, plug-in, or login is required.',
                joinDescription: process.env.JOIN_DESCRIPTION || 'Pick a room name.<br />How about this one?',
                joinButtonLabel: process.env.JOIN_BUTTON_LABEL || 'Присоединиться',
                joinLastLabel: process.env.JOIN_LAST_LABEL || 'История:',
            },

            /**
             * Website Configuration
             * --------------------
             * Site-wide settings including icons and page-specific content.
             */
            site: {
                title: process.env.SITE_TITLE || 'Кремлевка',
                icon: process.env.SITE_ICON_PATH || '../images/logo.svg',
                appleTouchIcon: process.env.APPLE_TOUCH_ICON_PATH || '../images/logo.svg',
                newRoomTitle: process.env.NEW_ROOM_TITLE || 'Pick name. <br />Share URL. <br />Start conference.',
                newRoomDescription:
                    process.env.NEW_ROOM_DESC || 'Each room has its disposable URL. Just pick a name and share.',
            },

            /**
             * SEO Metadata
             * ------------
             * Search engine optimization elements.
             */
            meta: {
                description:
                    process.env.META_DESCRIPTION ||
                    'Kremlevka for real-time video communications.',
                keywords: process.env.META_KEYWORDS || 'webrtc, video calls, conference, screen sharing, mirotalk, sfu',
            },

            /**
             * OpenGraph/Social Media
             * ---------------------
             * Metadata for rich social media sharing.
             */
            og: {
                type: process.env.OG_TYPE || 'app-webrtc',
                siteName: process.env.OG_SITE_NAME || 'Kremlevka',
                title: process.env.OG_TITLE || 'Click the link to make a call.',
                description:
                    process.env.OG_DESCRIPTION || 'Kremlevka provides real-time video calls and screen sharing.',
                image: process.env.OG_IMAGE_URL || 'https://sfu.mirotalk.com/images/mirotalksfu.png',
                url: process.env.OG_URL || 'https://sfu.mirotalk.com',
            },

            /**
             * UI Section Visibility
             * ---------------------
             * Toggle display of various page sections.
             * Set to 'false' via environment variables to hide.
             */
            html: {
                features: process.env.SHOW_FEATURES !== 'true',
                teams: process.env.SHOW_TEAMS !== 'false',
                tryEasier: process.env.SHOW_TRY_EASIER !== 'false',
                poweredBy: process.env.SHOW_POWERED_BY !== 'false',
                sponsors: process.env.SHOW_SPONSORS !== 'false',
                advertisers: process.env.SHOW_ADVERTISERS !== 'false',
                footer: process.env.SHOW_FOOTER !== 'false',
            },

            /**
             * Who Are You? Section
             * ---------------------
             * Prompts users to identify themselves before joining a room.
             * Customizable text and button labels.
             */
            whoAreYou: {
                title: process.env.WHO_ARE_YOU_TITLE || 'Who are you?',
                description:
                    process.env.WHO_ARE_YOU_DESCRIPTION ||
                    "If you\'re the presenter, please log in now.<br />Otherwise, kindly wait for the presenter to join.",
                buttonLoginLabel: process.env.WHO_ARE_YOU_BUTTON_LOGIN_LABEL || 'LOGIN',
                buttonJoinLabel: process.env.WHO_ARE_YOU_JOIN_LABEL || 'JOIN ROOM',
            },

            /**
             * About/Credits Section
             * ---------------------
             * Contains author information, version, and support links.
             * Supports HTML content for flexible formatting.
             */
            about: {
                imageUrl: process.env.ABOUT_IMAGE_URL || '../images/mirotalk-logo.gif',
                title: `WebRTC SFU v${packageJson.version}`,
                html: `
                    <button id="support-button" data-umami-event="Support button"
                        onclick="window.open('${process.env.SUPPORT_URL || 'https://codecanyon.net/user/miroslavpejic85'}', '_blank')">
                        <i class="fas fa-heart"></i> ${process.env.SUPPORT_TEXT || 'Support'}
                    </button>
                    <br />
                    <br />
                    ${process.env.AUTHOR_LABEL || 'Author'}: 
                    <a id="linkedin-button" data-umami-event="Linkedin button"
                        href="${process.env.LINKEDIN_URL || 'https://www.linkedin.com/in/miroslav-pejic-976a07101/'}" 
                        target="_blank">
                        ${process.env.AUTHOR_NAME || 'Miroslav Pejic'}
                    </a>
                    <br />
                    <br />
                    ${process.env.EMAIL_LABEL || 'Email'}: 
                    <a id="email-button" data-umami-event="Email button"
                        href="mailto:${process.env.CONTACT_EMAIL || ' '}?subject=${process.env.EMAIL_SUBJECT || 'Kremlevka'}">
                        ${process.env.CONTACT_EMAIL || ''}
                    </a>
                    <hr />
                    <span>
                        &copy; ${new Date().getFullYear()} ${process.env.COPYRIGHT_TEXT || 'Kremlevka, all rights reserved'}
                    </span>
                    <hr />
                    `,
            },

            /**
             * Widget Configuration
             * --------------------
             * Controls the appearance and behavior of the support widget.
             * Supports dynamic configuration via environment variables.
             */
            widget: {
                enabled: process.env.WIDGET_ENABLED === 'false',
                roomId: process.env.WIDGET_ROOM_ID || 'support-room',
                theme: process.env.WIDGET_THEME || 'dark',
                widgetState: process.env.WIDGET_STATE || 'minimized',
                widgetType: process.env.WIDGET_TYPE || 'support',
                supportWidget: {
                    position: process.env.WIDGET_SUPPORT_POSITION || 'top-right',
                    expertImages: process.env.WIDGET_SUPPORT_EXPERT_IMAGES
                        ? process.env.WIDGET_SUPPORT_EXPERT_IMAGES.split(splitChar)
                              .map((url) => url.trim())
                              .filter(Boolean)
                        : [
                              'https://photo.cloudron.pocketsolution.net/uploads/original/95/7d/a5f7f7a2c89a5fee7affda5f013c.jpeg',
                          ],
                    buttons: {
                        audio: process.env.WIDGET_SUPPORT_BUTTON_AUDIO !== 'false',
                        video: process.env.WIDGET_SUPPORT_BUTTON_VIDEO !== 'false',
                        screen: process.env.WIDGET_SUPPORT_BUTTON_SCREEN !== 'false',
                        chat: process.env.WIDGET_SUPPORT_BUTTON_CHAT !== 'false',
                        join: process.env.WIDGET_SUPPORT_BUTTON_JOIN !== 'false',
                    },
                    checkOnlineStatus: process.env.WIDGET_SUPPORT_CHECK_ONLINE_STATUS === 'true',
                    isOnline: process.env.WIDGET_SUPPORT_IS_ONLINE !== 'false',
                    customMessages: {
                        heading: process.env.WIDGET_SUPPORT_HEADING || 'Need Help?',
                        subheading:
                            process.env.WIDGET_SUPPORT_SUBHEADING || 'Get instant support from our expert team!',
                        connectText: process.env.WIDGET_SUPPORT_CONNECT_TEXT || 'connect in < 5 seconds',
                        onlineText: process.env.WIDGET_SUPPORT_ONLINE_TEXT || 'We are online',
                        offlineText: process.env.WIDGET_SUPPORT_OFFLINE_TEXT || 'We are offline',
                        poweredBy: process.env.WIDGET_SUPPORT_POWERED_BY || 'Powered by Kremlevka',
                    },
                },
                alert: {
                    enabled: process.env.WIDGET_ALERT_ENABLED === 'true',
                    type: process.env.WIDGET_ALERT_TYPE || 'email',
                },
            },
            //...
        },

        /**
         * UI Button Configuration
         * ---------------------
         * Organized by component/functionality area
         */
        buttons: {
            // Popup Configuration
            popup: {
                shareRoomPopup: process.env.SHOW_SHARE_ROOM_POPUP !== 'false',
                shareRoomQrOnHover: process.env.SHOW_SHARE_ROOM_QR_ON_HOVER !== 'false',
            },
            // Main control buttons visible in the UI
            main: {
                shareButton: process.env.SHOW_SHARE_BUTTON !== 'false',
                hideMeButton: process.env.SHOW_HIDE_ME !== 'false',
                fullScreenButton: process.env.SHOW_FULLSCREEN_BUTTON !== 'false',
                startAudioButton: process.env.SHOW_AUDIO_BUTTON !== 'false',
                startVideoButton: process.env.SHOW_VIDEO_BUTTON !== 'false',
                startScreenButton: process.env.SHOW_SCREEN_BUTTON !== 'false',
                swapCameraButton: process.env.SHOW_SWAP_CAMERA !== 'false',
                chatButton: process.env.SHOW_CHAT_BUTTON !== 'false',
                pollButton: process.env.SHOW_POLL_BUTTON !== 'false',
                editorButton: process.env.SHOW_EDITOR_BUTTON !== 'false',
                raiseHandButton: process.env.SHOW_RAISE_HAND !== 'false',
                transcriptionButton: process.env.SHOW_TRANSCRIPTION !== 'false',
                whiteboardButton: process.env.SHOW_WHITEBOARD !== 'false',
                documentPiPButton: process.env.SHOW_DOCUMENT_PIP !== 'false',
                snapshotRoomButton: process.env.SHOW_SNAPSHOT !== 'false',
                emojiRoomButton: process.env.SHOW_EMOJI !== 'false',
                settingsButton: process.env.SHOW_SETTINGS !== 'false',
                aboutButton: process.env.SHOW_ABOUT !== 'false',
                exitButton: process.env.SHOW_EXIT_BUTTON !== 'false',
                extraButton: process.env.SHOW_EXTRA_BUTTON !== 'false',
            },
            // Settings panel buttons and options
            settings: {
                fileSharing: process.env.ENABLE_FILE_SHARING !== 'false',
                lockRoomButton: process.env.SHOW_LOCK_ROOM !== 'false',
                unlockRoomButton: process.env.SHOW_UNLOCK_ROOM !== 'false',
                broadcastingButton: process.env.SHOW_BROADCASTING !== 'false',
                lobbyButton: process.env.SHOW_LOBBY !== 'false',
                sendEmailInvitation: process.env.SHOW_EMAIL_INVITE !== 'false',
                micOptionsButton: process.env.SHOW_MIC_OPTIONS !== 'false',
                tabRTMPStreamingBtn: process.env.SHOW_RTMP_TAB !== 'false',
                tabModerator: process.env.SHOW_MODERATOR_TAB !== 'false',
                tabRecording: process.env.SHOW_RECORDING_TAB !== 'false',
                host_only_recording: process.env.HOST_ONLY_RECORDING !== 'false',
                pushToTalk: process.env.ENABLE_PUSH_TO_TALK !== 'false',
                keyboardShortcuts: process.env.SHOW_KEYBOARD_SHORTCUTS !== 'false',
                virtualBackground: process.env.SHOW_VIRTUAL_BACKGROUND !== 'false',
            },

            // Video controls for producer (local user)
            producerVideo: {
                videoPictureInPicture: process.env.ENABLE_PIP !== 'false',
                videoMirrorButton: process.env.SHOW_MIRROR_BUTTON !== 'false',
                fullScreenButton: process.env.SHOW_FULLSCREEN !== 'false',
                snapShotButton: process.env.SHOW_SNAPSHOT_BUTTON !== 'false',
                muteAudioButton: process.env.SHOW_MUTE_AUDIO !== 'false',
                videoPrivacyButton: process.env.SHOW_PRIVACY_TOGGLE !== 'false',
                audioVolumeInput: process.env.SHOW_VOLUME_CONTROL !== 'false',
            },

            // Video controls for consumer (remote users)
            consumerVideo: {
                videoPictureInPicture: process.env.ENABLE_PIP !== 'false',
                videoMirrorButton: process.env.SHOW_MIRROR_BUTTON !== 'false',
                fullScreenButton: process.env.SHOW_FULLSCREEN !== 'false',
                snapShotButton: process.env.SHOW_SNAPSHOT_BUTTON !== 'false',
                focusVideoButton: process.env.SHOW_FOCUS_BUTTON !== 'false',
                sendMessageButton: process.env.SHOW_SEND_MESSAGE !== 'false',
                sendFileButton: process.env.SHOW_SEND_FILE !== 'false',
                sendVideoButton: process.env.SHOW_SEND_VIDEO !== 'false',
                muteVideoButton: process.env.SHOW_MUTE_VIDEO !== 'false',
                muteAudioButton: process.env.SHOW_MUTE_AUDIO !== 'false',
                audioVolumeInput: process.env.SHOW_VOLUME_CONTROL !== 'false',
                geolocationButton: process.env.SHOW_GEO_LOCATION !== 'false',
                banButton: process.env.SHOW_BAN_BUTTON !== 'false',
                ejectButton: process.env.SHOW_EJECT_BUTTON !== 'false',
            },

            // Controls when video is off
            videoOff: {
                sendMessageButton: process.env.SHOW_SEND_MESSAGE !== 'false',
                sendFileButton: process.env.SHOW_SEND_FILE !== 'false',
                sendVideoButton: process.env.SHOW_SEND_VIDEO !== 'false',
                muteAudioButton: process.env.SHOW_MUTE_AUDIO !== 'false',
                audioVolumeInput: process.env.SHOW_VOLUME_CONTROL !== 'false',
                geolocationButton: process.env.SHOW_GEO_LOCATION !== 'false',
                banButton: process.env.SHOW_BAN_BUTTON !== 'false',
                ejectButton: process.env.SHOW_EJECT_BUTTON !== 'false',
            },

            // Chat interface controls
            chat: {
                chatPinButton: process.env.SHOW_CHAT_PIN !== 'false',
                chatMaxButton: process.env.SHOW_CHAT_MAXIMIZE !== 'false',
                chatSaveButton: process.env.SHOW_CHAT_SAVE !== 'false',
                chatEmojiButton: process.env.SHOW_CHAT_EMOJI !== 'false',
                chatMarkdownButton: process.env.SHOW_CHAT_MARKDOWN !== 'false',
                chatSpeechStartButton: process.env.SHOW_CHAT_SPEECH !== 'false',
                chatGPT: process.env.ENABLE_CHAT_GPT !== 'false',
                deepSeek: process.env.ENABLE_DEEP_SEEK !== 'false',
            },

            // Poll interface controls
            poll: {
                pollPinButton: process.env.SHOW_POLL_PIN !== 'false',
                pollMaxButton: process.env.SHOW_POLL_MAXIMIZE !== 'false',
                pollSaveButton: process.env.SHOW_POLL_SAVE !== 'false',
            },

            // Participants list controls
            participantsList: {
                saveInfoButton: process.env.SHOW_SAVE_INFO !== 'false',
                sendFileAllButton: process.env.SHOW_SEND_FILE_ALL !== 'false',
                ejectAllButton: process.env.SHOW_EJECT_ALL !== 'false',
                sendFileButton: process.env.SHOW_SEND_FILE !== 'false',
                geoLocationButton: process.env.SHOW_GEO_LOCATION !== 'false',
                banButton: process.env.SHOW_BAN_BUTTON !== 'false',
                ejectButton: process.env.SHOW_EJECT_BUTTON !== 'false',
            },

            // Whiteboard controls
            whiteboard: {
                whiteboardLockButton: process.env.SHOW_WB_LOCK !== 'false',
            },
        },
    },

    // ==============================================
    // 8. Feature Flags
    // ==============================================

    features: {
        /**
         * Survey Configuration (QuestionPro)
         * =================================
         * Settings for user feedback and survey integration
         *
         * Setup Instructions:
         * ------------------
         * 1. Sign up at https://www.questionpro.com/
         * 2. Create survey:
         *    - Use template or custom questions
         *    - Configure survey logic and branching
         * 3. Get survey URL:
         *    - Publish survey
         *    - Copy "Collect Responses" link
         */
        survey: {
            enabled: process.env.SURVEY_ENABLED === 'true',
            url: process.env.SURVEY_URL || '',
        },

        /**
         * Post-Call Redirect
         * ---------------------
         * - enabled: Redirect after call ends
         * - url: Redirect destination URL
         */
        redirect: {
            enabled: process.env.REDIRECT_ENABLED === 'true',
            url: process.env.REDIRECT_URL || '',
        },

        /**
         * Usage Statistics Configuration (Umami)
         * =====================================
         * Privacy-focused analytics tracking for service improvement
         *
         * Setup Instructions:
         * ------------------
         * 1. Self-host Umami or use cloud version:
         *    - GitHub: https://github.com/umami-software/umami
         *    - Official Docs: https://umami.is/docs
         * 2. Create website entry in Umami dashboard
         * 3. Obtain tracking script URL and website ID
         *
         * Privacy & Security:
         * ------------------
         * - No cookies used (GDPR compliant)
         * - No persistent user tracking
         * - All data aggregated and anonymized
         * - Self-hosted option keeps data in your infrastructure
         *
         * Core Settings:
         * -------------
         * - enabled      : Enable/disable analytics [true/false] (default: true)
         * - src          : Umami tracking script URL
         * - id           : Your website ID from Umami
         */
        stats: {
            enabled: process.env.STATS_ENABLED !== 'false',
            src: process.env.STATS_SRC || 'https://stats.mirotalk.com/script.js',
            id: process.env.STATS_ID || '41d26670-f275-45bb-af82-3ce91fe57756',
        },
    },

    /**
     * Moderation Configuration
     * =======================
     * Controls global moderation features.
     *
     * Core Settings:
     * --------------
     * - room.maxParticipants: Maximum number of participants allowed per room.
     *   Adjust to limit room size and manage server load.
     */
    moderation: {
        room: {
            maxParticipants: parseInt(process.env.ROOM_MAX_PARTICIPANTS) || 1000, // Maximum participants per room
        },
    },

    // ==============================================
    // 9. Mediasoup (WebRTC) Configuration
    // ==============================================

    /**
     * Mediasoup Integration Resources
     * ==============================
     * Core WebRTC components powering MiroTalk SFU
     *
     * Essential Links:
     * ---------------
     * - 🌐 Website     : https://mediasoup.org
     * - 💬 Forum       : https://mediasoup.discourse.group
     *
     * 📚 Documentation:
     * ----------------
     * - Client API     : https://mediasoup.org/documentation/v3/mediasoup-client/api/
     * - Server API     : https://mediasoup.org/documentation/v3/mediasoup/api/
     * - Protocols      : https://mediasoup.org/documentation/v3/mediasoup/rtp-parameters-and-capabilities/
     *
     * 🔧 Key Components:
     * -----------------
     * - Router         : Manages RTP streams
     * - Transport      : Network connection handler
     * - Producer       : Media sender
     * - Consumer       : Media receiver
     *
     * Mediasoup Configuration
     * -----------------------
     * This configuration defines settings for mediasoup workers, routers,
     * WebRTC servers, and transports. These settings control how the SFU
     * (Selective Forwarding Unit) handles media processing and networking.
     */
    mediasoup: {
        /**
         * Worker Configuration
         * --------------------
         * Workers are separate processes that handle media processing.
         * Multiple workers can run in parallel for load balancing.
         */
        worker: {
            rtcMinPort: RTC_MIN_PORT, // Minimum UDP/TCP port for ICE, DTLS, RTP
            rtcMaxPort: RTC_MAX_PORT, // Maximum UDP/TCP port for ICE, DTLS, RTP

            // Disable Linux io_uring for certain operations (false = use if available)
            disableLiburing: false,

            // Logging level (error, warn, debug, etc.)
            logLevel: process.env.MEDIASOUP_LOG_LEVEL || 'error',

            // Detailed logging for specific components:
            logTags: [
                'info', // General information
                'ice', // ICE (Interactive Connectivity Establishment) events
                'dtls', // DTLS handshake and encryption
                'rtp', // RTP packet flow
                'srtp', // Secure RTP encryption
                'rtcp', // RTCP control protocol
                'rtx', // Retransmissions
                'bwe', // Bandwidth estimation
                'score', // Network score calculations
                'simulcast', // Simulcast layers
                'svc', // Scalable Video Coding
                'sctp', // SCTP data channels
            ],
        },
        numWorkers: NUM_WORKERS, // Number of mediasoup worker processes to create

        /**
         * Router Configuration
         * --------------------
         * Routers manage media streams and define what codecs are supported.
         * Each mediasoup worker can host multiple routers.
         */
        router: {
            // Enable audio level monitoring (for detecting who is speaking)
            audioLevelObserverEnabled: process.env.MEDIASOUP_ROUTER_AUDIO_LEVEL_OBSERVER_ENABLED !== 'false',

            // Disable active speaker detection (uses more CPU)
            activeSpeakerObserverEnabled: process.env.MEDIASOUP_ROUTER_ACTIVE_SPEAKER_OBSERVER_ENABLED === 'true',

            /**
             * Supported Media Codecs
             * ----------------------
             * Defines what codecs the SFU can receive and forward.
             * Order matters - first is preferred during negotiation.
             */
            mediaCodecs: [
                // Opus audio codec (standard for WebRTC)
                {
                    kind: 'audio',
                    mimeType: 'audio/opus',
                    clockRate: 48000, // Standard sample rate for WebRTC
                    channels: 2, // Stereo audio
                },

                // VP8 video codec (widely supported, good for compatibility)
                {
                    kind: 'video',
                    mimeType: 'video/VP8',
                    clockRate: 90000, // Standard video clock rate
                    parameters: {
                        'x-google-start-bitrate': 1000, // Initial bitrate (kbps)
                    },
                },

                // VP9 video codec (better compression than VP8)
                // Profile 0: Most widely supported VP9 profile
                {
                    kind: 'video',
                    mimeType: 'video/VP9',
                    clockRate: 90000,
                    parameters: {
                        'profile-id': 0, // Baseline profile
                        'x-google-start-bitrate': 1000,
                    },
                },

                // VP9 Profile 2: Supports HDR and 10/12-bit color
                {
                    kind: 'video',
                    mimeType: 'video/VP9',
                    clockRate: 90000,
                    parameters: {
                        'profile-id': 2, // Advanced profile
                        'x-google-start-bitrate': 1000,
                    },
                },

                // H.264 Baseline profile (widest hardware support)
                {
                    kind: 'video',
                    mimeType: 'video/h264',
                    clockRate: 90000,
                    parameters: {
                        'packetization-mode': 1, // Required for WebRTC
                        'profile-level-id': '42e01f', // Baseline 3.1
                        'level-asymmetry-allowed': 1, // Allows different levels
                        'x-google-start-bitrate': 1000,
                    },
                },

                // H.264 Main profile (better compression than Baseline)
                {
                    kind: 'video',
                    mimeType: 'video/h264',
                    clockRate: 90000,
                    parameters: {
                        'packetization-mode': 1,
                        'profile-level-id': '4d0032', // Main 4.0
                        'level-asymmetry-allowed': 1,
                        'x-google-start-bitrate': 1000,
                    },
                },
            ],
        },

        /**
         * WebRTC Server Configuration
         * ---------------------------
         * WebRTC servers handle ICE (connection establishment) and DTLS (encryption).
         * Can be disabled if using plain WebRtcTransport instead.
         *
         * Best used when:
         * - Running in controlled environments with fixed IPs
         * - Need to minimize port usage across workers
         * - Using StatefulSets/DaemonSets in Kubernetes
         *
         * Kubernetes considerations:
         * - Requires stable network identity (use StatefulSet)
         * - Needs NodePort/LoadBalancer with externalTrafficPolicy: Local
         * - Port ranges must be carefully allocated to avoid conflicts
         *
         * Optional Config:
         * - https://mediasoup.discourse.group/t/mediasoup-3-17-0-released/6805
         */
        webRtcServerActive: process.env.SFU_SERVER === 'true', // Enable if SFU_SERVER=true
        webRtcServerOptions: {
            // Network interfaces and ports for ICE candidates
            listenInfos: [
                /**
                 * UDP Configuration
                 * Preferred for media transport (lower latency)
                 * Kubernetes implications:
                 * - Each Pod needs unique ports if sharing host network
                 * - Consider using hostPort when not using LoadBalancer
                 */
                {
                    protocol: 'udp',
                    ip: LISTEN_IP, // Local IP to bind to
                    announcedAddress: IPv4, // Public IP sent to clients
                    portRange: {
                        min: RTC_MIN_PORT,
                        max: RTC_MIN_PORT + NUM_WORKERS, // Port range per worker
                    },
                },
                /**
                 * TCP Configuration
                 * Fallback for restrictive networks (higher latency)
                 * Kubernetes implications:
                 * - Helps with networks blocking UDP
                 * - May require separate Service definition in k8s
                 */
                {
                    protocol: 'tcp',
                    ip: LISTEN_IP,
                    announcedAddress: IPv4,
                    portRange: {
                        min: RTC_MIN_PORT,
                        max: RTC_MIN_PORT + NUM_WORKERS,
                    },
                },
            ],
        },

        /**
         * WebRTC Transport Configuration
         * ------------------------------
         * Transports handle the actual media flow between clients and the SFU.
         * These settings affect bandwidth management and network behavior.
         *
         * Preferred when:
         * - Running in cloud environments with auto-scaling
         * - Need dynamic port allocation
         * - Kubernetes Pods are ephemeral
         *
         * Kubernetes considerations:
         * - Requires wide port range exposure (50000-60000 typical)
         * - Works better with ClusterIP Services
         * - More resilient to Pod restarts
         */
        webRtcTransport: {
            // Network interfaces for media transmission
            listenInfos: [
                /**
                 * UDP Transport Settings
                 * Kubernetes implications:
                 * - Needs hostNetwork or privileged Pod for port access
                 * - Consider port range size based on expected scale
                 */
                {
                    protocol: 'udp',
                    ip: LISTEN_IP,
                    announcedAddress: IPv4,
                    portRange: {
                        min: RTC_MIN_PORT,
                        max: RTC_MAX_PORT, // Wider range than WebRtcServer
                    },
                },
                /**
                 * TCP Transport Settings
                 * Kubernetes implications:
                 * - Less efficient but more compatible
                 * - May require different Service configuration
                 */
                {
                    protocol: 'tcp',
                    ip: LISTEN_IP,
                    announcedAddress: IPv4,
                    portRange: {
                        min: RTC_MIN_PORT,
                        max: RTC_MAX_PORT,
                    },
                },
            ],

            iceConsentTimeout: 35, // Timeout for ICE consent (seconds)

            /**
             * Bandwidth Control Settings
             * Kubernetes implications:
             * - These values should be tuned based on Node resources
             * - Consider network plugin overhead (Calico, Cilium etc.)
             */
            initialAvailableOutgoingBitrate: 2500000, // 2.5 Mbps initial bitrate
            minimumAvailableOutgoingBitrate: 1000000, // 1 Mbps minimum guaranteed
            maxIncomingBitrate: 3000000, // 3 Mbps max per producer

            /**
             * Data Channel Settings
             * Kubernetes implications:
             * - Affects memory allocation per transport
             * - Larger sizes may require Pod resource adjustments
             */
            maxSctpMessageSize: 262144, // 256 KB max message size for data channels
        },
    },
};

// ==============================================
// Helper Functions
// ==============================================

/**
 * Get IPv4 Address
 * ----------------
 * - Prioritizes ANNOUNCED_IP if set
 * - Falls back to local IP detection
 */
function getIPv4() {
    if (ANNOUNCED_IP) return ANNOUNCED_IP;

    switch (ENVIRONMENT) {
        case 'development':
            return IS_DOCKER ? '127.0.0.1' : getLocalIPv4();
        case 'production':
            return ANNOUNCED_IP;
        default:
            return getLocalIPv4();
    }
}

/**
 * Detect Local IPv4 Address
 * -------------------------
 * - Handles different OS network interfaces
 * - Filters out virtual/docker interfaces
 */
function getLocalIPv4() {
    const ifaces = os.networkInterfaces();
    const platform = os.platform();

    const PRIORITY_CONFIG = {
        win32: [{ name: 'Ethernet' }, { name: 'Wi-Fi' }, { name: 'Local Area Connection' }],
        darwin: [{ name: 'en0' }, { name: 'en1' }],
        linux: [{ name: 'eth0' }, { name: 'wlan0' }],
    };

    const VIRTUAL_INTERFACES = {
        all: ['docker', 'veth', 'tun', 'lo'],
        win32: ['Virtual', 'vEthernet', 'Teredo', 'Bluetooth'],
        darwin: ['awdl', 'bridge', 'utun'],
        linux: ['virbr', 'kube', 'cni'],
    };

    const platformPriorities = PRIORITY_CONFIG[platform] || [];
    const virtualExcludes = [...VIRTUAL_INTERFACES.all, ...(VIRTUAL_INTERFACES[platform] || [])];

    // Check priority interfaces first
    for (const { name: ifName } of platformPriorities) {
        const matchingIfaces = platform === 'win32' ? Object.keys(ifaces).filter((k) => k.includes(ifName)) : [ifName];
        for (const interfaceName of matchingIfaces) {
            const addr = findValidAddress(ifaces[interfaceName]);
            if (addr) return addr;
        }
    }

    // Fallback to scanning all non-virtual interfaces
    const fallbackAddress = scanAllInterfaces(ifaces, virtualExcludes);
    if (fallbackAddress) return fallbackAddress;

    return '0.0.0.0';
}

/**
 * Scan All Network Interfaces
 * ---------------------------
 * - Checks all interfaces excluding virtual ones
 */
function scanAllInterfaces(ifaces, excludes) {
    for (const [name, addresses] of Object.entries(ifaces)) {
        if (excludes.some((ex) => name.toLowerCase().includes(ex.toLowerCase()))) {
            continue;
        }
        const addr = findValidAddress(addresses);
        if (addr) return addr;
    }
    return null;
}

/**
 * Find Valid Network Address
 * --------------------------
 * - Filters out internal and link-local addresses
 */
function findValidAddress(addresses) {
    return addresses?.find((addr) => addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.'))
        ?.address;
}

/**
 * Get FFmpeg Path
 * ---------------
 * - Checks common installation locations
 * - Platform-specific paths
 */
function getFFmpegPath(platform) {
    const paths = {
        darwin: ['/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg'],
        linux: ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'],
        win32: ['C:\\ffmpeg\\bin\\ffmpeg.exe', 'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe'],
    };

    const platformPaths = paths[platform] || ['/usr/bin/ffmpeg'];

    for (const path of platformPaths) {
        try {
            fs.accessSync(path);
            return path;
        } catch (e) {
            continue;
        }
    }

    return platformPaths[0];
}
