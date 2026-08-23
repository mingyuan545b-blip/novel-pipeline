/**
 * high-martial-crossplane/modules/supportingDepth.js — 配角深度模块
 *
 * 功能边界：配角写活的素材标准（凡人修仙传级别）
 * 装备此模块后，配角素材标准从8字段升级为13字段
 */
module.exports = {
    id: 'supporting-depth',
    label: '配角深度',
    description: '配角写活硬约束：自主命运线/主角镜像/标志性细节/独立立场/命运弧光',

    characterProfileOverrides: {
        supportingTags: [
            '【年龄】具体年龄',
            '【外貌】1-2句标志性外貌特征（不需要面面俱到）',
            '【性格】2-3个性格特征词+简短行为描述',
            '【说话语气】语言习惯（1句即可）',
            '【核心欲望】角色最深层想要什么——这是配角自主命运线的核心，不是"帮主角"',
            '【内在矛盾】角色内心的矛盾冲突（如：想守护家人却身不由己/想独善其身却无法冷眼旁观）',
            '【身份/职位】在故事世界中的位置',
            '【与主角关系】和主角的关系定位+互动模式',
            '【主角镜像】与主角形成什么对比或互补（如：冲动vs冷静/重情vs薄情/理想vs现实）——配角是主角的镜子',
            '【标志性细节】一个让读者永远记住的动作/习惯/物件（如厉飞雨的鬼脸/文樯留给女儿的娃娃/墨大夫的亦师亦敌）',
            '【出场功能】叙事功能（导师/对手/盟友/信息源/催化剂）+是否可延展（退场后能否再激活）',
            '【独立立场】这个角色的行为由什么立场驱动（利益/报恩/自保/道义/野心），不是单纯服务主角——每个人都为自己而活',
            '【命运弧光】这个配角的情感/命运走向（如：从隐忍到爆发/从信任到背叛/从卑微到尊严/一念心动半生留白）'
        ],
        supportingWordCount: 400,
        supportingExample: '【年龄】[具体年龄]【外貌】[1-2句标志性外貌特征]【性格】[2-3个性格特征词]+[简短行为描述]【说话语气】[语言习惯（1句即可）]【核心欲望】[角色最深层想要什么]【身份/职位】[在故事世界中的位置]【与主角关系】[和主角的关系定位+互动模式]【出场功能】[叙事功能（导师/对手/盟友/信息源）]',
        supportingWriterPrinciples: '【配角写活硬约束 - 凡人修仙传级别标准 - 必须遵守】\n写配角时必须做到以下7点，做不到的配角就是工具人，工具人读者记不住：\n1. 配角有自主命运线：配角的核心欲望是自己的追求，不是"帮主角"。厉飞雨修炼象甲功透支寿命是为了自己的尊严，不是为了韩立\n2. 配角是主角的镜子：通过对比/互补折射主角性格。厉飞雨冲动→对比韩立冷静，紫灵敢爱敢恨→对比韩立情感节制\n3. 一个细节定住角色：给配角一个标志性细节（动作/习惯/物件），让读者过目不忘。厉飞雨趁人转身做鬼脸、文樯留给女儿的娃娃、墨大夫亦师亦敌\n4. 配角有独立立场：配角的行为由自己的利益/道义/报恩驱动，不是主角的附庸。文樯帮韩立是因为良知，不是因为忠诚\n5. 配角有内在矛盾：想A却不得不B，内心挣扎让角色立体。南宫婉想陪伴韩立却身负宗门责任\n6. 配角有命运弧光：从起点到终点有情感/命运变化。曹梦容从心动到终身未嫁，一念心动半生留白\n7. 配角可退场可回归：阶段性陪伴，退场不是消失，可在新情境下再激活赋予新意义',
        supportingOrganizerDimensions: '🔷配角记录关键状态变化+配角写活维度：\n   - 战力等级变化、阵营变化、与主角关系变化\n   - 标志性细节：本章是否展现了配角的标志性动作/习惯/物件\n   - 主角镜像：本章配角与主角的对比/互补是否被强化\n   - 独立立场：配角的行为是否由自己的立场驱动（而非单纯服务主角）\n   - 命运弧光：配角的情感/命运是否有推进\n   - 内在矛盾：配角的内心挣扎是否有新展现\n   细枝末节忽略，但配角写活维度必须捕捉',
        supportingTrackingFields: [
            'signatureDetail',
            'protagonistMirror',
            'independentStance',
            'fateArc',
            'innerConflict'
        ],
        supportingRegistrarNoteFields: [
            'signatureDetailNote',
            'protagonistMirrorNote',
            'independentStanceNote',
            'fateArcNote',
            'innerConflictNote'
        ]
    },

    agentAccess: ['writer', 'reviser', 'material-manager', 'first-review', 'second-review'],
    dependencies: [],

    // 配角戏份量化标准（每N章窗口内必须满足的最低戏份）
    // 用于firstReview的配角反工具人化硬检测
    supportingRoleQuota: {
        windowChapters: 5,
        quotas: {
            main: {
                minAppearChapters: 2,            // 主要配角每5章至少出场2章
                minSubversiveBehaviors: 1,       // 至少1次反预期行为
                minInnerVoiceScenes: 1,          // 至少1次内心描写
                minAutonomousDecisions: 1,       // 至少1次自主决策
                arcProgressionWindow: 10,        // 命运弧光推进窗口
                minArcProgressions: 1            // 每10章至少1次弧光推进
            },
            supporting: {
                minAppearChapters: 1,
                minSubversiveBehaviors: 1,
                minInnerVoiceScenes: 1,
                minAutonomousDecisions: 0,
                arcProgressionWindow: 15,
                minArcProgressions: 1
            }
        },
        signatureDetailInterval: 3,   // 每3章至少展现1次标志性细节
        mirrorContrastInterval: 5     // 每5章至少1次与主角的对比/互补展现
    }
};
