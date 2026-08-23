/**
 * no-store-direct-call.js — ESLint自定义规则
 * 对应PROJECT_STANDARDS第9条：所有Agent必须通过DataContext读取数据
 * 禁止Agent直接调用store.getItem/queryItems/listItems读取数据
 *
 * 使用AST解析替代正则，精准检测CallExpression，天然排除注释
 *
 * 扫描范围由eslint.config.js的files配置控制（只对R1扫描目录生效）
 * 白名单由eslint.config.js的overrides配置排除
 * 保持与 verifyProjectStandards.js 的 R1 校验范围完全一致
 */
'use strict';

/** 禁止的store读取方法（第9条只禁止读取，写入允许） */
const FORBIDDEN_METHODS = new Set(['getItem', 'queryItems', 'listItems']);

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: '禁止Agent直接调用store读取数据，必须通过DataContext',
            category: 'PROJECT_STANDARDS',
            recommended: true,
        },
        schema: [],
        messages: {
            directCall:
                'PROJECT_STANDARDS R1违规：Agent不得直接调用 store.{{method}}()，必须通过 DataContext 委托方法读取数据',
        },
    },
    create(context) {
        return {
            // 检测 store.xxx() 形式的调用
            CallExpression(node) {
                const callee = node.callee;
                if (!callee || callee.type !== 'MemberExpression') return;

                // object 必须是 Identifier 且名为 store
                const obj = callee.object;
                if (!obj || obj.type !== 'Identifier' || obj.name !== 'store') return;

                // property 必须是 Identifier 且在禁止列表中
                const prop = callee.property;
                if (!prop || prop.type !== 'Identifier') return;
                if (!FORBIDDEN_METHODS.has(prop.name)) return;

                context.report({
                    node,
                    messageId: 'directCall',
                    data: { method: prop.name },
                });
            },
        };
    },
};
