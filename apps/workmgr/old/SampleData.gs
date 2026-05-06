/**
 * ============================================
 * SAMPLE DATA GENERATOR - Tạo dữ liệu mẫu
 * 50 rows mỗi sheet, logic liên kết chặt chẽ
 * ============================================
 */

function generateAllSampleData() {
  const departments = _genDepartments();
  const members = _genMembers(departments);
  const projects = _genProjects(members, departments);
  const tasks = _genTasks(projects, members);
  const comments = _genComments(tasks, members);
  const activities = _genActivities(projects, tasks, members);
  const notifications = _genNotifications(tasks, members);
  const labels = _genLabels();
  const settings = _genSettings();

  return { settings, members, departments, projects, tasks, comments, activities, notifications, labels };
}

// ── Helpers ──
function _d(y,m,d,h,min) { return new Date(y, m-1, d, h||8, min||0); }
function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function _pad(n) { return String(n).padStart(3, '0'); }

// ── CÀI ĐẶT ──
function _genSettings() {
  return [
    ['Khóa', 'Giá Trị'],
    ['Tên công ty', 'Công Ty Phần Mềm Thành Đạt'],
    ['Email công ty', 'info@thanhdat.vn'],
    ['Số điện thoại', '028 3825 6789'],
    ['Địa chỉ', '123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh'],
    ['Website', 'https://thanhdat.vn'],
    ['Mã số thuế', '0312345678'],
    ['admin_username', 'admin'],
    ['admin_password', 'admin123'],
    ['Logo URL', ''],
    ['Số ngày phép tối đa', '12'],
    ['Giờ làm việc', '08:00 - 17:30'],
    ['Ngày nghỉ tuần', 'Thứ 7, Chủ Nhật'],
  ];
}

// ── PHÒNG BAN ──
function _genDepartments() {
  const depts = [
    ['PB001','Ban Giám Đốc','Điều hành và quản lý chung','TV001'],
    ['PB002','Phòng Công Nghệ','Phát triển phần mềm, hạ tầng','TV002'],
    ['PB003','Phòng Thiết Kế','UI/UX, Graphic Design','TV006'],
    ['PB004','Phòng Kinh Doanh','Bán hàng, CSKH, phát triển thị trường','TV010'],
    ['PB005','Phòng Nhân Sự','Tuyển dụng, đào tạo, phúc lợi','TV014'],
    ['PB006','Phòng Marketing','Truyền thông, quảng cáo, SEO','TV018'],
    ['PB007','Phòng Tài Chính','Kế toán, ngân sách, thuế','TV022'],
    ['PB008','Phòng QA','Kiểm thử, đảm bảo chất lượng','TV026'],
    ['PB009','Phòng DevOps','Hạ tầng, CI/CD, triển khai','TV030'],
    ['PB010','Phòng Sản Phẩm','Quản lý sản phẩm, nghiên cứu','TV034'],
  ];
  const header = ['Mã PB','Tên Phòng Ban','Mô Tả','Trưởng Phòng','Mã Trưởng Phòng','Ngày Tạo'];
  const rows = [header];
  depts.forEach(d => rows.push([d[0], d[1], d[2], '', d[3], _d(2025,6,1)]));
  return { rows, list: depts };
}

// ── THÀNH VIÊN (50) ──
function _genMembers(departments) {
  const header = ['Mã TV','Họ và Tên','Email','Số Điện Thoại','Chức Vụ','Phòng Ban','Vai Trò','Tên Đăng Nhập','Mật Khẩu','Trạng Thái','Ảnh Đại Diện','Ngày Tham Gia','Ghi Chú'];

  const ho = ['Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Võ','Đặng','Bùi','Đỗ','Vũ','Phan','Ngô','Dương','Lý'];
  const dem = ['Văn','Thị','Đức','Minh','Quốc','Thanh','Hoàng','Phương','Tuấn','Thành','Thu','Ngọc','Hải','Xuân','Anh'];
  const ten = ['An','Bình','Cường','Dũng','Em','Phúc','Giang','Hà','Khánh','Linh','Mai','Nam','Oanh','Phong','Quân','Rồng','Sơn','Tâm','Uyên','Việt','Yến','Đông','Hưng','Khoa','Long','Minh','Nhật','Trí','Tùng','Thảo','Hương','Lan','Cúc','Đào','Hồng','Lam','Trung','Hiếu','Toàn','Hùng','Duy','Kiên','Lộc','Tiến','Thắng','Bảo','Châu','Diệp','Hạnh','Trang'];

  const deptNames = departments.list.map(d => d[1]);
  const roles = [
    {cv:'Giám Đốc',vt:'Chủ Doanh Nghiệp',pb:'Ban Giám Đốc'},
    {cv:'Trưởng Phòng',vt:'Leader',pb:null},
    {cv:'Phó Phòng',vt:'Leader',pb:null},
    {cv:'Nhân Viên',vt:'Thành Viên',pb:null},
  ];

  const rows = [header];
  const memberList = [];

  for (let i = 1; i <= 50; i++) {
    const id = 'TV' + _pad(i);
    const name = ho[i % ho.length] + ' ' + dem[i % dem.length] + ' ' + ten[i-1];
    const email = ten[i-1].toLowerCase().replace(/[^a-z]/g,'') + i + '@thanhdat.vn';
    const phone = '09' + String(10000000 + i * 131071).substring(0, 8);
    let role, chucVu, phongBan;

    if (i === 1) { chucVu = 'Giám Đốc'; role = 'Chủ Doanh Nghiệp'; phongBan = 'Ban Giám Đốc'; }
    else if (i <= 10 && i % 4 === 2) { chucVu = 'Trưởng Phòng'; role = 'Leader'; phongBan = deptNames[Math.floor((i-2)/4) + 1] || deptNames[i % deptNames.length]; }
    else if (i <= 10 && i % 4 === 3) { chucVu = 'Phó Phòng'; role = 'Leader'; phongBan = deptNames[Math.floor((i-3)/4) + 1] || deptNames[i % deptNames.length]; }
    else { chucVu = 'Nhân Viên'; role = 'Thành Viên'; phongBan = deptNames[(i % (deptNames.length - 1)) + 1]; }

    const username = ten[i-1].toLowerCase().replace(/[^a-z]/g,'') + i;
    const status = i <= 45 ? 'Hoạt Động' : 'Vô Hiệu';
    const joinDate = _d(2025, 1 + Math.floor((i-1)/5), 1 + (i % 28));

    memberList.push({ id, name, email, phone, chucVu, phongBan, role, username });
    rows.push([id, name, email, phone, chucVu, phongBan, role, username, '123456', status, '', joinDate, '']);
  }

  // Cập nhật tên trưởng phòng vào sheet Phòng Ban
  departments.list.forEach(d => {
    const leader = memberList.find(m => m.id === d[3]);
    if (leader) d[3] = leader.name;
  });
  // Rebuild dept rows with names
  departments.rows = [departments.rows[0]];
  departments.list.forEach(d => departments.rows.push([d[0], d[1], d[2], d[3], memberList.find(m => m.name === d[3])?.id || '', _d(2025,6,1)]));

  return { rows, list: memberList };
}

// ── DỰ ÁN (15 dự án, đủ logic cho 50 task) ──
function _genProjects(members, departments) {
  const header = ['Mã DA','Tên Dự Án','Mô Tả','Trạng Thái','Mức Độ Ưu Tiên','Ngân Sách','Chi Phí Thực Tế','Ngày Bắt Đầu','Ngày Kết Thúc Dự Kiến','Ngày Hoàn Thành','Leader','Mã Leader','Thành Viên Tham Gia','Tiến Độ','Ngày Tạo','Người Tạo','Ghi Chú'];

  const projectData = [
    ['DA001','Website Thương Mại Điện Tử','Xây dựng nền tảng e-commerce B2C với thanh toán VNPay, MoMo','Đang Thực Hiện','Cao',800000000,350000000,'2025-10-01','2026-06-30','','TV002',75],
    ['DA002','Ứng Dụng Mobile iOS/Android','Phát triển app mobile đa nền tảng bằng React Native','Đang Thực Hiện','Cao',600000000,280000000,'2025-11-01','2026-08-31','','TV002',55],
    ['DA003','Hệ Thống CRM Nội Bộ','Quản lý khách hàng, đơn hàng, chăm sóc sau bán','Đang Thực Hiện','Trung Bình',400000000,150000000,'2025-12-01','2026-05-31','','TV006',40],
    ['DA004','Cổng Thanh Toán Tích Hợp','API gateway tích hợp đa cổng thanh toán','Hoàn Thành','Cao',300000000,285000000,'2025-06-01','2025-12-31','2025-12-20','TV002',100],
    ['DA005','Hệ Thống ERP','Quản lý tài nguyên doanh nghiệp tổng thể','Lên Kế Hoạch','Cao',1500000000,0,'2026-04-01','2027-03-31','','TV002',0],
    ['DA006','Redesign Website Công Ty','Thiết kế lại giao diện website chính thức','Đang Thực Hiện','Trung Bình',150000000,80000000,'2026-01-01','2026-04-30','','TV006',60],
    ['DA007','Chatbot AI Hỗ Trợ Khách Hàng','Tích hợp AI chatbot tự động trả lời','Đang Thực Hiện','Cao',250000000,100000000,'2026-01-15','2026-07-15','','TV002',30],
    ['DA008','Data Warehouse & BI','Xây dựng kho dữ liệu và báo cáo thông minh','Lên Kế Hoạch','Trung Bình',500000000,0,'2026-05-01','2026-12-31','','TV030',5],
    ['DA009','Hệ Thống Quản Lý Kho','WMS quản lý nhập xuất tồn kho thời gian thực','Đang Thực Hiện','Trung Bình',350000000,120000000,'2025-12-15','2026-06-15','','TV002',50],
    ['DA010','Ứng Dụng Nội Bộ HR','Hệ thống chấm công, nghỉ phép, đánh giá KPI','Hoàn Thành','Trung Bình',200000000,195000000,'2025-05-01','2025-11-30','2025-11-25','TV014',100],
    ['DA011','Microservices Migration','Chuyển đổi monolith sang kiến trúc microservices','Đang Thực Hiện','Cao',700000000,250000000,'2026-01-01','2026-09-30','','TV030',35],
    ['DA012','Marketing Automation Platform','Nền tảng tự động hóa marketing email, SMS','Lên Kế Hoạch','Trung Bình',280000000,0,'2026-06-01','2026-11-30','','TV018',0],
    ['DA013','Mobile Payment Integration','Tích hợp Apple Pay, Google Pay, Samsung Pay','Tạm Dừng','Thấp',180000000,50000000,'2026-01-10','2026-05-10','','TV002',20],
    ['DA014','Security Audit & Compliance','Kiểm tra bảo mật, đạt chứng chỉ ISO 27001','Đang Thực Hiện','Cao',120000000,60000000,'2026-02-01','2026-05-31','','TV030',45],
    ['DA015','Cloud Infrastructure Optimization','Tối ưu hạ tầng cloud AWS, giảm chi phí 30%','Đang Thực Hiện','Trung Bình',100000000,40000000,'2026-02-01','2026-04-30','','TV030',55],
  ];

  const leaders = members.list.filter(m => m.role === 'Leader' || m.role === 'Chủ Doanh Nghiệp');
  const membersList = members.list.filter(m => m.role === 'Thành Viên');

  const rows = [header];
  const projList = [];

  projectData.forEach((p, idx) => {
    const leader = members.list.find(m => m.id === p[10]) || leaders[idx % leaders.length];
    // Assign 3-6 members to each project
    const teamSize = 3 + (idx % 4);
    const teamIds = [leader.id];
    for (let j = 0; j < teamSize; j++) {
      const m = membersList[(idx * 4 + j) % membersList.length];
      if (!teamIds.includes(m.id)) teamIds.push(m.id);
    }

    const startParts = p[7].split('-');
    const endParts = p[8].split('-');
    const startDate = new Date(+startParts[0], +startParts[1]-1, +startParts[2]);
    const endDate = new Date(+endParts[0], +endParts[1]-1, +endParts[2]);
    let completedDate = '';
    if (p[9]) { const cp = p[9].split('-'); completedDate = new Date(+cp[0], +cp[1]-1, +cp[2]); }

    projList.push({ id: p[0], name: p[1], leaderId: leader.id, leaderName: leader.name, status: p[3], teamIds, startDate, endDate });

    rows.push([
      p[0], p[1], p[2], p[3], p[4], p[5], p[6],
      startDate, endDate, completedDate,
      leader.name, leader.id, teamIds.join(','), p[11],
      _d(2025, 10, 1 + idx), 'TV001', ''
    ]);
  });

  return { rows, list: projList };
}

// ── CÔNG VIỆC (50) ──
function _genTasks(projects, members) {
  const header = ['Mã CV','Tiêu Đề','Mô Tả','Mã Dự Án','Tên Dự Án','Người Thực Hiện','Mã Người Thực Hiện','Người Giao','Mã Người Giao','Trạng Thái','Mức Độ Ưu Tiên','Ngày Bắt Đầu','Ngày Hết Hạn','Ngày Hoàn Thành','Chi Phí Ước Tính','Chi Phí Thực Tế','Nhãn','Tiến Độ','Ngày Tạo','Ghi Chú'];

  const taskTemplates = [
    // DA001 - E-commerce (10 tasks)
    ['Thiết kế giao diện trang chủ','Design wireframe và mockup cho trang chủ responsive','DA001','Design,UI/UX','Hoàn Thành',100,15000000,14000000],
    ['Phát triển module giỏ hàng','Xây dựng shopping cart với localStorage, session','DA001','Frontend,Feature','Đang Thực Hiện',70,20000000,12000000],
    ['Tích hợp VNPay','Kết nối cổng thanh toán VNPay IPN callback','DA001','Backend,API','Đang Thực Hiện',50,25000000,10000000],
    ['Tích hợp MoMo Payment','API thanh toán MoMo QR, ATM','DA001','Backend,API','Cần Làm',0,20000000,0],
    ['Hệ thống quản lý sản phẩm','CRUD sản phẩm, danh mục, biến thể','DA001','Backend,Feature','Hoàn Thành',100,30000000,28000000],
    ['SEO Optimization','Tối ưu meta tags, sitemap, structured data','DA001','Frontend,SEO','Đang Xem Xét',80,8000000,6000000],
    ['Tích hợp live chat','Widget chat trực tuyến hỗ trợ khách hàng','DA001','Frontend,Feature','Cần Làm',0,5000000,0],
    ['Dashboard Admin','Trang quản trị đơn hàng, doanh thu, thống kê','DA001','Frontend,Backend','Đang Thực Hiện',45,18000000,8000000],
    ['API đơn hàng & vận chuyển','REST API quản lý đơn, tích hợp GHN, GHTK','DA001','Backend,API','Cần Làm',0,22000000,0],
    ['Unit Test module thanh toán','Viết test coverage >80% cho payment module','DA001','Testing,QA','Cần Làm',0,6000000,0],
    // DA002 - Mobile (8 tasks)
    ['Thiết kế UI kit mobile','Design system cho React Native app','DA002','Design,UI/UX','Hoàn Thành',100,12000000,11000000],
    ['Màn hình đăng nhập/đăng ký','Auth flow với OTP, social login','DA002','Frontend,Feature','Đang Thực Hiện',60,10000000,5000000],
    ['Push notification service','Firebase Cloud Messaging cho Android/iOS','DA002','Backend,Feature','Đang Thực Hiện',40,8000000,3000000],
    ['Offline mode & sync','SQLite local storage, background sync','DA002','Frontend,Backend','Cần Làm',0,15000000,0],
    ['Performance optimization mobile','Reduce bundle size, lazy loading, caching','DA002','Frontend,DevOps','Đang Xem Xét',75,7000000,5000000],
    ['In-app purchase integration','Thanh toán trong ứng dụng iOS/Android','DA002','Backend,Feature','Lên Kế Hoạch',0,18000000,0],
    ['Kiểm thử UI trên đa thiết bị','Test trên 20+ thiết bị Android/iOS','DA002','Testing,QA','Cần Làm',0,5000000,0],
    ['Deep linking & App indexing','Universal links, App links cho SEO mobile','DA002','Frontend,SEO','Cần Làm',0,6000000,0],
    // DA003 - CRM (6 tasks)
    ['Module quản lý khách hàng','CRUD khách hàng, phân loại, tags','DA003','Backend,Feature','Đang Thực Hiện',55,20000000,10000000],
    ['Pipeline sales dashboard','Biểu đồ pipeline, funnel, conversion rate','DA003','Frontend,Feature','Đang Thực Hiện',35,15000000,5000000],
    ['Email marketing tích hợp','Gửi email hàng loạt, template, tracking','DA003','Backend,Feature','Cần Làm',0,12000000,0],
    ['Báo cáo & xuất Excel','Export data ra Excel, PDF, CSV','DA003','Backend,Feature','Đang Xem Xét',90,8000000,7000000],
    ['Import dữ liệu từ Excel','Upload và map columns tự động','DA003','Backend,Feature','Hoàn Thành',100,6000000,5500000],
    ['Tích hợp Zalo OA','Gửi tin nhắn ZNS, quản lý follower','DA003','Backend,API','Cần Làm',0,10000000,0],
    // DA006 - Redesign (5 tasks)
    ['Nghiên cứu UX & wireframe','User research, persona, user flow mới','DA006','Design,UI/UX','Hoàn Thành',100,8000000,7500000],
    ['Thiết kế trang About Us','Design trang giới thiệu công ty','DA006','Design','Đang Thực Hiện',70,4000000,2500000],
    ['Responsive cho mobile','Tối ưu giao diện responsive mọi thiết bị','DA006','Frontend','Đang Thực Hiện',50,6000000,3000000],
    ['Animation & micro-interaction','Hiệu ứng scroll, hover, transition','DA006','Frontend,Design','Cần Làm',0,5000000,0],
    ['Tối ưu tốc độ tải trang','Core Web Vitals, lazy load, CDN','DA006','Frontend,DevOps','Đang Xem Xét',85,4000000,3500000],
    // DA007 - Chatbot AI (5 tasks)
    ['Thu thập & xử lý dữ liệu FAQ','Chuẩn bị training data từ FAQ hiện có','DA007','Backend,AI','Hoàn Thành',100,10000000,9000000],
    ['Xây dựng model NLP','Fine-tune GPT model cho tiếng Việt','DA007','Backend,AI','Đang Thực Hiện',45,30000000,12000000],
    ['Widget chat frontend','Giao diện chat bubble, typing indicator','DA007','Frontend,Feature','Đang Thực Hiện',60,8000000,4000000],
    ['Tích hợp Messenger & Zalo','Kết nối chatbot qua Messenger, Zalo','DA007','Backend,API','Cần Làm',0,12000000,0],
    ['Dashboard phân tích hội thoại','Thống kê câu hỏi, satisfaction score','DA007','Frontend,Backend','Cần Làm',0,8000000,0],
    // DA009 - Warehouse (4 tasks)
    ['Module nhập kho','Quản lý phiếu nhập, nhà cung cấp','DA009','Backend,Feature','Đang Thực Hiện',65,15000000,8000000],
    ['Module xuất kho','Phiếu xuất, đối soát, in barcode','DA009','Backend,Feature','Đang Thực Hiện',50,15000000,7000000],
    ['Báo cáo tồn kho realtime','Dashboard số lượng tồn, cảnh báo hết hàng','DA009','Frontend,Backend','Cần Làm',0,10000000,0],
    ['Tích hợp máy quét mã vạch','API scan barcode/QR từ thiết bị cầm tay','DA009','Backend,Feature','Cần Làm',0,8000000,0],
    // DA011 - Microservices (4 tasks)
    ['Tách service User Management','Extract user module thành microservice','DA011','Backend,DevOps','Đang Thực Hiện',60,25000000,12000000],
    ['API Gateway setup','Kong/Nginx API gateway, rate limiting','DA011','DevOps,Backend','Đang Thực Hiện',40,20000000,8000000],
    ['Message Queue integration','RabbitMQ/Kafka cho async communication','DA011','Backend,DevOps','Cần Làm',0,18000000,0],
    ['Service monitoring & logging','ELK stack, Prometheus, Grafana dashboard','DA011','DevOps','Đang Xem Xét',70,15000000,10000000],
    // DA014 - Security (4 tasks)
    ['Penetration testing','Kiểm tra lỗ hổng OWASP Top 10','DA014','Testing,Security','Đang Thực Hiện',50,15000000,7000000],
    ['Mã hóa dữ liệu nhạy cảm','Encryption at rest, in transit, key rotation','DA014','Backend,Security','Đang Thực Hiện',40,10000000,4000000],
    ['Audit log & access control','Ghi log mọi thao tác, RBAC nâng cao','DA014','Backend,Security','Cần Làm',0,12000000,0],
    ['Tài liệu ISO 27001','Chuẩn bị documentation cho audit ISO','DA014','Documentation','Đang Xem Xét',60,5000000,3000000],
    // DA015 - Cloud (2 tasks)
    ['Phân tích chi phí AWS','Review billing, rightsizing EC2, RDS','DA015','DevOps','Đang Thực Hiện',70,3000000,2000000],
    ['Auto-scaling & spot instances','Cấu hình ASG, spot fleet, reserved','DA015','DevOps','Đang Thực Hiện',50,4000000,1500000],
  ];

  const statuses = ['Cần Làm','Đang Thực Hiện','Đang Xem Xét','Hoàn Thành'];
  const priorities = ['Cao','Trung Bình','Thấp'];
  const allMembers = members.list.filter(m => m.role === 'Thành Viên');
  const rows = [header];
  const taskList = [];

  taskTemplates.forEach((t, idx) => {
    const id = 'CV' + _pad(idx + 1);
    const proj = projects.list.find(p => p.id === t[2]);
    if (!proj) return;

    // Chọn người thực hiện từ team dự án
    const teamMembers = proj.teamIds.map(tid => members.list.find(m => m.id === tid)).filter(Boolean);
    const assignee = teamMembers[idx % teamMembers.length] || allMembers[idx % allMembers.length];
    const assigner = members.list.find(m => m.id === proj.leaderId) || members.list[0];

    const status = t[4];
    const progress = t[5];
    const budget = t[6];
    const actual = t[7];
    const priority = budget >= 20000000 ? 'Cao' : budget >= 10000000 ? 'Trung Bình' : 'Thấp';

    // Tính ngày hợp lý
    const dayOffset = idx * 3;
    const startDate = new Date(proj.startDate);
    startDate.setDate(startDate.getDate() + dayOffset);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 14 + (idx % 10));
    const completedDate = status === 'Hoàn Thành' ? new Date(endDate.getTime() - 86400000 * 2) : '';

    taskList.push({ id, title: t[0], projectId: t[2], assigneeId: assignee.id, assigneeName: assignee.name, assignerId: assigner.id, assignerName: assigner.name, status });

    rows.push([
      id, t[0], t[1], t[2], proj.name,
      assignee.name, assignee.id, assigner.name, assigner.id,
      status, priority, startDate, endDate, completedDate,
      budget, actual, t[3], progress, _d(2025, 10, 1 + (idx % 28)), ''
    ]);
  });

  return { rows, list: taskList };
}

// ── BÌNH LUẬN (50) ──
function _genComments(tasks, members) {
  const header = ['Mã BL','Mã Công Việc','Nội Dung','Người Bình Luận','Mã Người Bình Luận','Ngày Tạo','Đã Chỉnh Sửa'];
  const commentTexts = [
    'Bản thiết kế đã ổn, anh duyệt rồi nhé.','Em cập nhật lại phần header cho đúng spec.',
    'API response time hơi chậm, cần optimize lại.','Đã fix xong bug #234, em push code rồi.',
    'Cần thêm validation cho form input.','Check lại phần responsive trên tablet.',
    'Unit test coverage đạt 85% rồi.','Deadline sắp tới, mọi người cố gắng nhé.',
    'Design mới trông chuyên nghiệp hơn nhiều!','Cần review lại phần security authentication.',
    'Đã deploy lên staging để test.','Performance cải thiện 40% sau khi optimize.',
    'Em gửi bản demo cho khách xem rồi ạ.','Khách hàng feedback tích cực, tiếp tục nhé.',
    'Cần thêm dark mode cho settings.','Database schema đã update, cần migrate.',
    'Code review xong, có vài chỗ cần refactor.','Em sẽ hoàn thành trước thứ 6.',
    'Trang này load nhanh hơn dự kiến!','Cần thêm loading skeleton cho UX tốt hơn.',
    'Đã tích hợp xong Sentry cho error tracking.','Push notification hoạt động tốt trên cả 2 platform.',
    'Cần update document API mới nhất.','Em suggest dùng Redis cache cho query nặng.',
    'Mockup đã gửi qua Figma, mọi người review giúp.','Đã xử lý xong edge case khi mất mạng.',
    'Em thêm analytics tracking cho conversion funnel.','Test automation chạy pass 100% rồi.',
    'Cần họp nhanh để sync progress.','Bản release v2.1 sẵn sàng deploy production.',
    'Bug hotfix đã merge vào main branch.','API rate limiting đã config xong.',
    'Cần thêm filter theo ngày cho báo cáo.','Em update i18n cho tiếng Việt.',
    'Docker image build thành công, size giảm 60%.','CI/CD pipeline chạy ổn định.',
    'Cần review UX flow cho checkout process.','Data migration script đã test xong trên staging.',
    'Cần backup database trước khi deploy.','Email template responsive đã fix.',
    'WebSocket connection ổn định, latency <50ms.','Đã setup monitoring alert cho CPU >80%.',
    'Cache invalidation strategy cần xem lại.','Em thêm bulk import feature theo yêu cầu.',
    'A/B testing đã setup, chờ data 1 tuần.','Search engine đã index 95% nội dung.',
    'SSL certificate sắp hết hạn, cần renew.','Backup tự động chạy đúng schedule.',
    'Image optimization giảm 70% dung lượng.','Paginate API đã support cursor-based.',
  ];

  const rows = [header];
  const allMembers = members.list.filter(m => m.role !== 'Vô Hiệu');

  for (let i = 0; i < 50; i++) {
    const task = tasks.list[i % tasks.list.length];
    const commenter = allMembers[i % allMembers.length];
    const date = _d(2026, 1 + Math.floor(i/20), 1 + (i % 28), 8 + (i % 10), (i * 7) % 60);

    rows.push([
      'BL' + _pad(i + 1), task.id, commentTexts[i],
      commenter.name, commenter.id, date, i % 8 === 0 ? 'Có' : 'Không'
    ]);
  }
  return { rows };
}

// ── HOẠT ĐỘNG (50) ──
function _genActivities(projects, tasks, members) {
  const header = ['Mã HĐ','Loại','Mô Tả','Đối Tượng','Mã Đối Tượng','Người Thực Hiện','Mã Người Thực Hiện','Ngày Tạo'];
  const types = ['Tạo Dự Án','Tạo Công Việc','Cập Nhật Trạng Thái','Thêm Thành Viên','Cập Nhật Dự Án','Hoàn Thành Công Việc','Giao Việc','Bình Luận','Xóa Công Việc','Cập Nhật Tiến Độ'];
  const rows = [header];

  for (let i = 0; i < 50; i++) {
    const type = types[i % types.length];
    const member = members.list[i % members.list.length];
    let desc, obj, objId;

    if (type.includes('Dự Án')) {
      const p = projects.list[i % projects.list.length];
      desc = type + ': ' + p.name; obj = 'Dự Án'; objId = p.id;
    } else if (type.includes('Thành Viên')) {
      desc = type + ': ' + member.name; obj = 'Thành Viên'; objId = member.id;
    } else {
      const t = tasks.list[i % tasks.list.length];
      desc = type + ': ' + t.title; obj = 'Công Việc'; objId = t.id;
    }

    const date = _d(2026, 1 + Math.floor(i/25), 1 + (i % 28), 8 + (i % 9), (i * 11) % 60);
    rows.push(['HD' + _pad(i + 1), type, desc, obj, objId, member.name, member.id, date]);
  }
  return { rows };
}

// ── THÔNG BÁO (50) ──
function _genNotifications(tasks, members) {
  const header = ['Mã TB','Tiêu Đề','Nội Dung','Loại','Người Nhận','Mã Người Nhận','Đã Đọc','Ngày Tạo'];
  const notifTypes = [
    { title: 'Bạn được giao công việc mới', type: 'Giao Việc' },
    { title: 'Bình luận mới trong công việc', type: 'Bình Luận' },
    { title: 'Công việc sắp đến hạn', type: 'Hệ Thống' },
    { title: 'Dự án đã được cập nhật', type: 'Hệ Thống' },
    { title: 'Bạn được thêm vào dự án', type: 'Hệ Thống' },
  ];
  const rows = [header];
  const allMembers = members.list.filter(m => m.role !== 'Vô Hiệu');

  for (let i = 0; i < 50; i++) {
    const nt = notifTypes[i % notifTypes.length];
    const receiver = allMembers[i % allMembers.length];
    const task = tasks.list[i % tasks.list.length];
    const content = nt.type === 'Giao Việc' ? 'Công việc: ' + task.title :
                    nt.type === 'Bình Luận' ? 'Có bình luận mới trong ' + task.id :
                    'Cập nhật liên quan đến ' + task.title;
    const read = i < 30 ? 'Đã Đọc' : 'Chưa';
    const date = _d(2026, 1 + Math.floor(i/25), 1 + (i % 28), 7 + (i % 12), (i * 13) % 60);

    rows.push(['TB' + _pad(i + 1), nt.title, content, nt.type, receiver.name, receiver.id, read, date]);
  }
  return { rows };
}

// ── NHÃN (15) ──
function _genLabels() {
  return [
    ['Mã Nhãn','Tên Nhãn','Màu Sắc','Ngày Tạo'],
    ['N001','Bug','#e53935',_d(2025,6,1)],['N002','Feature','#43a047',_d(2025,6,1)],
    ['N003','Design','#fb8c00',_d(2025,6,1)],['N004','UI/UX','#8e24aa',_d(2025,6,1)],
    ['N005','Backend','#1e88e5',_d(2025,6,1)],['N006','Frontend','#00acc1',_d(2025,6,1)],
    ['N007','API','#5e35b1',_d(2025,6,1)],['N008','Testing','#3949ab',_d(2025,6,1)],
    ['N009','QA','#00897b',_d(2025,6,1)],['N010','DevOps','#546e7a',_d(2025,6,1)],
    ['N011','Documentation','#6d4c41',_d(2025,6,1)],['N012','Urgent','#c62828',_d(2025,6,1)],
    ['N013','Security','#d84315',_d(2025,6,1)],['N014','SEO','#00838f',_d(2025,6,1)],
    ['N015','AI','#4527a0',_d(2025,6,1)],
  ];
}
