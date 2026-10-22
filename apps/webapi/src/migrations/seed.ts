import { listQuerySchema, type AudienceRules } from '@cdp/contracts';
import { database } from '../config/database.js';
import { resourceService } from '../services/resources.js';
import type { Resource } from '../models/index.js';

async function ensure(resource: Resource, key: string, input: Record<string, unknown>, scope: Record<string, string> = {}) {
  const query = listQuerySchema.parse({ pageSize: 100, ...(resource === 'metadata' ? { type: input.metadataType } : {}) });
  let page = 1;
  while (true) {
    const result = await resourceService.list(resource, { ...query, page }, scope);
    const existing = result.data.find(row => row[key] === input[key]);
    if (existing) return existing;
    if (page * query.pageSize >= result.pagination.total) break;
    page++;
  }
  return resourceService.create(resource, input, scope);
}

type EnumDefinition = readonly [label: string, value: string | number];

async function ensureValues(resource: 'metadataValues' | 'dimensionValues', ownerId: string, definitions: readonly EnumDefinition[]) {
  const scope: Record<string, string> = resource === 'metadataValues' ? { metadataId: ownerId } : { dimensionId: ownerId };
  for (const [sortOrder, [label, value]] of definitions.entries())
    await ensure(resource, 'value', { label, value, sortOrder }, scope);
}

async function ensureMetadata(input: Record<string, unknown>, values?: readonly EnumDefinition[]) {
  const metadata = await ensure('metadata', 'fieldName', input);
  if (values) await ensureValues('metadataValues', metadata.id, values);
  return metadata;
}

async function ensureDimension(eventModelId: string, input: Record<string, unknown>, values?: readonly EnumDefinition[]) {
  const dimension = await ensure('dimensions', 'fieldName', input, { eventModelId });
  if (values) await ensureValues('dimensionValues', dimension.id, values);
  return dimension;
}

async function ensureMetric(eventModelId: string, input: Record<string, unknown>) {
  return ensure('metrics', 'fieldName', { dataType: 'Number', ...input }, { eventModelId });
}

try {
  const member = await ensureMetadata({ metadataType: 'TAG', name: '会员等级', fieldName: 'member_level', description: '会员成长体系中的当前等级', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['普通会员', 'NORMAL'], ['银卡会员', 'SILVER'], ['金卡会员', 'GOLD'], ['钻石会员', 'DIAMOND']]);
  await ensure('metadata', 'fieldName', { metadataType: 'TAG', name: '用户活跃分', fieldName: 'active_score', description: '业务定义的用户活跃程度评分', dataType: 'Number', displayType: 'NUMBER', isEnum: false });
  await ensureMetadata({ metadataType: 'TAG', name: '生命周期阶段', fieldName: 'lifecycle_stage', description: '用户在当前运营生命周期中的阶段', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['新用户', 'NEW'], ['成长期', 'GROWTH'], ['成熟期', 'MATURE'], ['沉默期', 'DORMANT'], ['已流失', 'LOST']]);
  await ensureMetadata({ metadataType: 'TAG', name: '用户价值分层', fieldName: 'customer_value_tier', description: '根据消费与活跃表现形成的价值层级', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['高价值', 'HIGH'], ['中价值', 'MEDIUM'], ['低价值', 'LOW']]);
  await ensureMetadata({ metadataType: 'TAG', name: '近30天活跃度', fieldName: 'activity_level_30d', description: '最近30天内的综合活跃水平', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['高活跃', 'HIGH'], ['中活跃', 'MEDIUM'], ['低活跃', 'LOW'], ['沉默', 'SILENT']]);
  await ensureMetadata({ metadataType: 'TAG', name: '购买频次分层', fieldName: 'purchase_frequency_tier', description: '按近90天订单频次划分的购买层级', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['高频购买', 'HIGH'], ['中频购买', 'MEDIUM'], ['低频购买', 'LOW'], ['尚未购买', 'NONE']]);
  await ensureMetadata({ metadataType: 'TAG', name: '优惠敏感度', fieldName: 'promotion_sensitivity', description: '用户对优惠券和促销活动的响应程度', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['高敏感', 'HIGH'], ['一般', 'MEDIUM'], ['低敏感', 'LOW']]);
  await ensureMetadata({ metadataType: 'TAG', name: '偏好品类', fieldName: 'preferred_category', description: '根据浏览和购买行为归纳的主要品类偏好', dataType: 'String', displayType: 'MULTI_SELECT', isEnum: true }, [['数码家电', 'DIGITAL'], ['服装鞋帽', 'CLOTHING'], ['食品饮料', 'FOOD'], ['美妆个护', 'BEAUTY'], ['家居生活', 'HOME'], ['母婴用品', 'MATERNAL']]);
  await ensureMetadata({ metadataType: 'TAG', name: '流失风险', fieldName: 'churn_risk_level', description: '根据活跃衰减和购买间隔识别的流失风险', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['高风险', 'HIGH'], ['中风险', 'MEDIUM'], ['低风险', 'LOW']]);
  await ensureMetadata({ metadataType: 'TAG', name: '是否付费用户', fieldName: 'is_paying_user', description: '用户是否产生过成功支付订单', dataType: 'Boolean', displayType: 'BOOLEAN', isEnum: false });
  await ensureMetadata({ metadataType: 'TAG', name: 'RFM综合分', fieldName: 'rfm_score', description: '最近购买、购买频次和消费金额的综合评分', dataType: 'Number', displayType: 'NUMBER', isEnum: false });
  const age = await ensure('metadata', 'fieldName', { metadataType: 'ATTRIBUTE', name: '年龄', fieldName: 'age', description: '用户年龄，单位为周岁', dataType: 'Number', displayType: 'NUMBER', isEnum: false });
  const city = await ensureMetadata({ metadataType: 'ATTRIBUTE', name: '所在城市', fieldName: 'city', description: '用户常驻城市', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['上海', 'SHANGHAI'], ['北京', 'BEIJING'], ['杭州', 'HANGZHOU'], ['深圳', 'SHENZHEN'], ['广州', 'GUANGZHOU'], ['成都', 'CHENGDU'], ['南京', 'NANJING'], ['武汉', 'WUHAN']]);
  await ensure('metadata', 'fieldName', { metadataType: 'ATTRIBUTE', name: '注册时间', fieldName: 'registered_at', description: '用户完成注册的时间', dataType: 'DateTime', displayType: 'DATETIME', isEnum: false });
  await ensureMetadata({ metadataType: 'ATTRIBUTE', name: '性别', fieldName: 'gender', description: '用户填写的性别信息', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['未知', 'UNKNOWN'], ['男性', 'MALE'], ['女性', 'FEMALE']]);
  await ensureMetadata({ metadataType: 'ATTRIBUTE', name: '注册渠道', fieldName: 'registration_channel', description: '用户首次完成注册的来源渠道', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['自然访问', 'ORGANIC'], ['广告投放', 'AD'], ['社交分享', 'SOCIAL'], ['线下门店', 'STORE'], ['合作渠道', 'PARTNER']]);
  await ensureMetadata({ metadataType: 'ATTRIBUTE', name: '设备类型', fieldName: 'primary_device_type', description: '用户最常使用的终端类型', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['iOS', 'IOS'], ['Android', 'ANDROID'], ['网页端', 'WEB'], ['小程序', 'MINI_PROGRAM']]);
  await ensureMetadata({ metadataType: 'ATTRIBUTE', name: '最近活跃时间', fieldName: 'last_active_at', description: '用户最近一次产生有效行为的时间', dataType: 'DateTime', displayType: 'DATETIME', isEnum: false });
  await ensureMetadata({ metadataType: 'ATTRIBUTE', name: '生日', fieldName: 'birthday', description: '用户填写的出生日期', dataType: 'Date', displayType: 'DATE', isEnum: false });
  await ensureMetadata({ metadataType: 'ATTRIBUTE', name: '累计消费金额', fieldName: 'lifetime_value', description: '历史成功订单的累计实付金额，单位元', dataType: 'Number', displayType: 'NUMBER', isEnum: false });
  await ensureMetadata({ metadataType: 'ATTRIBUTE', name: '累计订单数', fieldName: 'total_order_count', description: '历史成功支付订单总数', dataType: 'Number', displayType: 'NUMBER', isEnum: false });
  await ensureMetadata({ metadataType: 'ATTRIBUTE', name: '当前积分', fieldName: 'loyalty_points', description: '会员账户当前可用积分', dataType: 'Number', displayType: 'NUMBER', isEnum: false });
  await ensureMetadata({ metadataType: 'ATTRIBUTE', name: '营销订阅状态', fieldName: 'marketing_opt_in', description: '用户是否同意接收营销消息', dataType: 'Boolean', displayType: 'BOOLEAN', isEnum: false });
  await ensureMetadata({ metadataType: 'ATTRIBUTE', name: '首次购买时间', fieldName: 'first_purchase_at', description: '用户第一笔成功订单的支付时间', dataType: 'DateTime', displayType: 'DATETIME', isEnum: false });
  await ensureMetadata({ metadataType: 'ATTRIBUTE', name: '最近购买时间', fieldName: 'last_purchase_at', description: '用户最近一笔成功订单的支付时间', dataType: 'DateTime', displayType: 'DATETIME', isEnum: false });
  const purchase = await ensure('events', 'eventCode', { name: '商品购买', eventCode: 'product_purchase', description: '用户完成商品支付的业务事件' });
  const category = await ensureDimension(purchase.id, { name: '商品分类', fieldName: 'product_category', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['数码产品', 'DIGITAL'], ['服装鞋帽', 'CLOTHING'], ['食品饮料', 'FOOD'], ['美妆个护', 'BEAUTY'], ['家居生活', 'HOME']]);
  await ensure('dimensions', 'fieldName', { name: '商品品牌', fieldName: 'product_brand', dataType: 'String', displayType: 'TEXT', isEnum: false }, { eventModelId: purchase.id });
  await ensureDimension(purchase.id, { name: '购买渠道', fieldName: 'order_channel', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['App', 'APP'], ['网页端', 'WEB'], ['小程序', 'MINI_PROGRAM'], ['线下门店', 'STORE']]);
  await ensureDimension(purchase.id, { name: '支付方式', fieldName: 'payment_method', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['微信支付', 'WECHAT_PAY'], ['支付宝', 'ALIPAY'], ['银行卡', 'BANK_CARD'], ['会员余额', 'BALANCE']]);
  const amount = await ensureMetric(purchase.id, { name: '购买金额', fieldName: 'purchase_amount', description: '实付金额，单位元' });
  await ensureMetric(purchase.id, { name: '购买数量', fieldName: 'purchase_quantity' });
  await ensureMetric(purchase.id, { name: '优惠金额', fieldName: 'discount_amount', description: '订单优惠总额，单位元' });
  await ensureMetric(purchase.id, { name: '订单原价', fieldName: 'original_amount', description: '优惠前订单金额，单位元' });
  const pageView = await ensure('events', 'eventCode', { name: '页面访问', eventCode: 'page_view', description: '用户访问业务页面的事件' });
  await ensure('dimensions', 'fieldName', { name: '页面路径', fieldName: 'page_path', dataType: 'String', displayType: 'TEXT', isEnum: false }, { eventModelId: pageView.id });
  await ensureDimension(pageView.id, { name: '页面类型', fieldName: 'page_type', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['首页', 'HOME'], ['商品详情', 'PRODUCT_DETAIL'], ['活动页', 'CAMPAIGN'], ['搜索结果', 'SEARCH_RESULT'], ['购物车', 'CART']]);
  await ensureDimension(pageView.id, { name: '流量来源', fieldName: 'traffic_source', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['直接访问', 'DIRECT'], ['搜索引擎', 'SEARCH'], ['广告投放', 'AD'], ['社交分享', 'SOCIAL'], ['站内跳转', 'INTERNAL']]);
  await ensureDimension(pageView.id, { name: '设备类型', fieldName: 'device_type', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['iOS', 'IOS'], ['Android', 'ANDROID'], ['网页端', 'WEB'], ['小程序', 'MINI_PROGRAM']]);
  await ensureMetric(pageView.id, { name: '停留时长', fieldName: 'duration_seconds', description: '单位为秒' });
  await ensureMetric(pageView.id, { name: '滚动深度', fieldName: 'scroll_depth', description: '页面最大滚动百分比' });

  const cart = await ensure('events', 'eventCode', { name: '加入购物车', eventCode: 'add_to_cart', description: '用户将商品加入购物车的事件' });
  await ensureDimension(cart.id, { name: '商品分类', fieldName: 'product_category', dataType: 'String', displayType: 'TEXT', isEnum: false });
  await ensureDimension(cart.id, { name: '商品SKU', fieldName: 'product_sku', dataType: 'String', displayType: 'TEXT', isEnum: false });
  await ensureDimension(cart.id, { name: '加入渠道', fieldName: 'cart_channel', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['App', 'APP'], ['网页端', 'WEB'], ['小程序', 'MINI_PROGRAM']]);
  await ensureMetric(cart.id, { name: '加入数量', fieldName: 'cart_quantity' });
  await ensureMetric(cart.id, { name: '商品金额', fieldName: 'item_amount', description: '加入购物车时的商品单价' });

  const productView = await ensure('events', 'eventCode', { name: '浏览商品', eventCode: 'product_view', description: '用户查看商品详情的事件' });
  await ensureDimension(productView.id, { name: '商品分类', fieldName: 'product_category', dataType: 'String', displayType: 'TEXT', isEnum: false });
  await ensureDimension(productView.id, { name: '商品SKU', fieldName: 'product_sku', dataType: 'String', displayType: 'TEXT', isEnum: false });
  await ensureDimension(productView.id, { name: '入口位置', fieldName: 'entry_position', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['首页推荐', 'HOME_RECOMMEND'], ['搜索结果', 'SEARCH_RESULT'], ['活动页', 'CAMPAIGN'], ['购物车', 'CART'], ['分享链接', 'SHARE']]);
  await ensureMetric(productView.id, { name: '浏览时长', fieldName: 'view_duration_seconds', description: '商品详情页停留秒数' });

  const search = await ensure('events', 'eventCode', { name: '站内搜索', eventCode: 'site_search', description: '用户提交站内搜索关键词的事件' });
  await ensureDimension(search.id, { name: '搜索关键词', fieldName: 'search_keyword', dataType: 'String', displayType: 'TEXT', isEnum: false });
  await ensureDimension(search.id, { name: '搜索入口', fieldName: 'search_source', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['顶部搜索框', 'HEADER'], ['分类页', 'CATEGORY'], ['搜索历史', 'HISTORY'], ['推荐词', 'SUGGESTION']]);
  await ensureDimension(search.id, { name: '结果状态', fieldName: 'result_status', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['有结果', 'HAS_RESULT'], ['无结果', 'NO_RESULT']]);
  await ensureMetric(search.id, { name: '结果数量', fieldName: 'result_count' });

  const login = await ensure('events', 'eventCode', { name: '用户登录', eventCode: 'user_login', description: '用户成功登录业务系统的事件' });
  await ensureDimension(login.id, { name: '登录渠道', fieldName: 'login_channel', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['App', 'APP'], ['网页端', 'WEB'], ['小程序', 'MINI_PROGRAM']]);
  await ensureDimension(login.id, { name: '认证方式', fieldName: 'auth_method', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['密码', 'PASSWORD'], ['短信验证码', 'SMS'], ['微信授权', 'WECHAT'], ['单点登录', 'SSO']]);
  await ensureDimension(login.id, { name: '设备系统', fieldName: 'device_os', dataType: 'String', displayType: 'TEXT', isEnum: false });

  const couponClaim = await ensure('events', 'eventCode', { name: '领取优惠券', eventCode: 'coupon_claim', description: '用户成功领取优惠券的事件' });
  await ensureDimension(couponClaim.id, { name: '优惠券类型', fieldName: 'coupon_type', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['满减券', 'THRESHOLD'], ['折扣券', 'DISCOUNT'], ['品类券', 'CATEGORY'], ['无门槛券', 'CASH']]);
  await ensureDimension(couponClaim.id, { name: '活动编码', fieldName: 'campaign_code', dataType: 'String', displayType: 'TEXT', isEnum: false });
  await ensureMetric(couponClaim.id, { name: '券面价值', fieldName: 'coupon_value', description: '优惠券标称优惠金额' });

  const couponUse = await ensure('events', 'eventCode', { name: '使用优惠券', eventCode: 'coupon_use', description: '用户在订单中核销优惠券的事件' });
  await ensureDimension(couponUse.id, { name: '优惠券类型', fieldName: 'coupon_type', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['满减券', 'THRESHOLD'], ['折扣券', 'DISCOUNT'], ['品类券', 'CATEGORY'], ['无门槛券', 'CASH']]);
  await ensureDimension(couponUse.id, { name: '活动编码', fieldName: 'campaign_code', dataType: 'String', displayType: 'TEXT', isEnum: false });
  await ensureMetric(couponUse.id, { name: '优惠金额', fieldName: 'discount_amount' });
  await ensureMetric(couponUse.id, { name: '订单金额', fieldName: 'order_amount' });

  const refund = await ensure('events', 'eventCode', { name: '订单退款', eventCode: 'order_refund', description: '订单完成退款的业务事件' });
  await ensureDimension(refund.id, { name: '退款原因', fieldName: 'refund_reason', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['商品问题', 'PRODUCT_ISSUE'], ['物流问题', 'LOGISTICS'], ['拍错或多拍', 'USER_MISTAKE'], ['价格变化', 'PRICE_CHANGE'], ['其他', 'OTHER']]);
  await ensureDimension(refund.id, { name: '退款类型', fieldName: 'refund_type', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['仅退款', 'REFUND_ONLY'], ['退货退款', 'RETURN_REFUND']]);
  await ensureDimension(refund.id, { name: '商品分类', fieldName: 'product_category', dataType: 'String', displayType: 'TEXT', isEnum: false });
  await ensureMetric(refund.id, { name: '退款金额', fieldName: 'refund_amount' });
  await ensureMetric(refund.id, { name: '退款商品数', fieldName: 'refund_quantity' });

  const registration = await ensure('events', 'eventCode', { name: '用户注册', eventCode: 'user_registration', description: '用户完成账号注册的事件' });
  await ensureDimension(registration.id, { name: '注册渠道', fieldName: 'registration_channel', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['自然访问', 'ORGANIC'], ['广告投放', 'AD'], ['社交分享', 'SOCIAL'], ['线下门店', 'STORE'], ['合作渠道', 'PARTNER']]);
  await ensureDimension(registration.id, { name: '注册终端', fieldName: 'registration_platform', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['iOS', 'IOS'], ['Android', 'ANDROID'], ['网页端', 'WEB'], ['小程序', 'MINI_PROGRAM']]);
  await ensureDimension(registration.id, { name: '推广活动编码', fieldName: 'campaign_code', dataType: 'String', displayType: 'TEXT', isEnum: false });

  const service = await ensure('events', 'eventCode', { name: '客服咨询', eventCode: 'customer_service', description: '用户发起客服咨询并结束会话的事件' });
  await ensureDimension(service.id, { name: '咨询渠道', fieldName: 'service_channel', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['在线客服', 'ONLINE'], ['电话', 'PHONE'], ['企业微信', 'WECHAT_WORK'], ['线下门店', 'STORE']]);
  await ensureDimension(service.id, { name: '问题类型', fieldName: 'issue_type', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['商品咨询', 'PRODUCT'], ['订单问题', 'ORDER'], ['物流问题', 'LOGISTICS'], ['退款售后', 'AFTER_SALES'], ['账户问题', 'ACCOUNT']]);
  await ensureDimension(service.id, { name: '满意度', fieldName: 'satisfaction_level', dataType: 'String', displayType: 'SELECT', isEnum: true }, [['满意', 'SATISFIED'], ['一般', 'NEUTRAL'], ['不满意', 'DISSATISFIED']]);
  await ensureMetric(service.id, { name: '响应时长', fieldName: 'response_seconds', description: '首次响应耗时，单位秒' });
  await ensureMetric(service.id, { name: '解决时长', fieldName: 'resolution_minutes', description: '从受理到结束的分钟数' });
  const rules: AudienceRules = [
    [
      { metadataType: 'ATTRIBUTE', metadataId: age.id, operator: 'GT', value: 25 },
      { metadataType: 'TAG', metadataId: member.id, operator: 'EQ', value: 'GOLD' },
      { metadataType: 'EVENT', eventId: purchase.id, timeRange: { type: 'RELATIVE', unit: 'DAY', value: 30 }, dimensionFilters: [{ dimensionId: category.id, operator: 'EQ', value: 'DIGITAL' }], aggregation: { type: 'SUM', metricId: amount.id }, operator: 'GT', value: 1000 },
    ],
    [{ metadataType: 'ATTRIBUTE', metadataId: city.id, operator: 'EQ', value: 'SHANGHAI' }],
  ];
  await ensure('audiences', 'audienceCode', { name: '高价值数码用户', audienceCode: 'high_value_digital', description: '金卡及高价值数码购买用户，或上海用户；仅为规则演示', rules, status: 'CONFIGURED' });
  console.info('丰富的演示元数据、行为模型与人群规则已就绪；未创建真实用户或计算结果。');
} catch (error) {
  console.error('演示数据初始化失败：', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally { await database.close(); }
