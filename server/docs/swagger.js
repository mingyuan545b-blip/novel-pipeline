const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Novel Pipeline API',
            version: '2.0.0',
            description: 'AI小说创作流水线系统API文档'
        },
        servers: [
            { url: '/api', description: '当前服务器' }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            }
        },
        security: [{ bearerAuth: [] }]
    },
    apis: [
        './server/routes/*.js',
        './server/routes/pipeline/*.js'
    ]
};

const specs = swaggerJsdoc(options);

function setupSwagger(app) {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Novel Pipeline API Docs'
    }));
}

module.exports = { setupSwagger, specs };
