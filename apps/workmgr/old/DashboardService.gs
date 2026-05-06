/**
 * ============================================
 * DASHBOARD SERVICE - Thống kê tổng hợp
 * ============================================
 */

function getDashboard(userId, userRole) {
  try {
    const projects = sheetToJSON('Dự Án');
    const tasks = sheetToJSON('Công Việc');
    const members = sheetToJSON('Thành Viên');
    const activities = sheetToJSON('Hoạt Động');
    const settings = getSettings();
    
    // ── Thống kê dự án ──
    const projectStats = {
      total: projects.length,
      planning: projects.filter(p => p['Trạng Thái'] === 'Lên Kế Hoạch').length,
      inProgress: projects.filter(p => p['Trạng Thái'] === 'Đang Thực Hiện').length,
      completed: projects.filter(p => p['Trạng Thái'] === 'Hoàn Thành').length,
      paused: projects.filter(p => p['Trạng Thái'] === 'Tạm Dừng').length,
      cancelled: projects.filter(p => p['Trạng Thái'] === 'Đã Hủy').length
    };
    
    // ── Thống kê công việc ──
    const taskStats = {
      total: tasks.length,
      todo: tasks.filter(t => t['Trạng Thái'] === 'Cần Làm').length,
      inProgress: tasks.filter(t => t['Trạng Thái'] === 'Đang Thực Hiện').length,
      review: tasks.filter(t => t['Trạng Thái'] === 'Đang Xem Xét').length,
      completed: tasks.filter(t => t['Trạng Thái'] === 'Hoàn Thành').length
    };
    
    // ── Công việc quá hạn ──
    const now = new Date();
    const overdueTasks = tasks.filter(t => {
      if (t['Trạng Thái'] === 'Hoàn Thành') return false;
      const deadline = parseDateStr(t['Ngày Hết Hạn']);
      return deadline.getTime() > 0 && deadline < now;
    });
    
    // ── Thống kê thành viên ──
    const memberStats = {
      total: members.length,
      active: members.filter(m => m['Trạng Thái'] === 'Hoạt Động').length,
      inactive: members.filter(m => m['Trạng Thái'] !== 'Hoạt Động').length
    };
    
    // ── Ngân sách tổng ──
    let totalBudget = 0;
    let totalActualCost = 0;
    projects.forEach(p => {
      totalBudget += safeParseNumber(p['Ngân Sách']);
      totalActualCost += safeParseNumber(p['Chi Phí Thực Tế']);
    });
    
    // ── Tasks theo mức độ ưu tiên ──
    const priorityStats = {
      high: tasks.filter(t => t['Mức Độ Ưu Tiên'] === 'Cao').length,
      medium: tasks.filter(t => t['Mức Độ Ưu Tiên'] === 'Trung Bình').length,
      low: tasks.filter(t => t['Mức Độ Ưu Tiên'] === 'Thấp').length
    };
    
    // ── Tasks theo thành viên ──
    const memberTaskMap = {};
    tasks.forEach(t => {
      const name = t['Người Thực Hiện'] || 'Chưa giao';
      if (!memberTaskMap[name]) memberTaskMap[name] = { todo: 0, inProgress: 0, completed: 0, total: 0 };
      memberTaskMap[name].total++;
      if (t['Trạng Thái'] === 'Cần Làm') memberTaskMap[name].todo++;
      else if (t['Trạng Thái'] === 'Đang Thực Hiện') memberTaskMap[name].inProgress++;
      else if (t['Trạng Thái'] === 'Hoàn Thành') memberTaskMap[name].completed++;
    });
    
    const memberTaskStats = Object.keys(memberTaskMap).map(name => ({
      name,
      ...memberTaskMap[name]
    }));
    
    // ── Tiến độ dự án ──
    const projectProgress = projects.map(p => ({
      name: p['Tên Dự Án'],
      progress: safeParseNumber(p['Tiến Độ']),
      status: p['Trạng Thái'],
      budget: safeParseNumber(p['Ngân Sách']),
      actualCost: safeParseNumber(p['Chi Phí Thực Tế'])
    }));
    
    // ── Hoạt động gần đây ──
    const recentActivities = activities.slice(-20).reverse();
    
    // ── Tasks sắp hết hạn (7 ngày tới) ──
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingTasks = tasks.filter(t => {
      if (t['Trạng Thái'] === 'Hoàn Thành') return false;
      const deadline = parseDateStr(t['Ngày Hết Hạn']);
      return deadline.getTime() > 0 && deadline >= now && deadline <= nextWeek;
    });
    
    // ── Xu hướng hoàn thành task theo tuần (4 tuần gần nhất) ──
    const weeklyTrend = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7 + weekStart.getDay()));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59);
      
      const completed = tasks.filter(t => {
        const completedDate = parseDateStr(t['Ngày Hoàn Thành']);
        return completedDate.getTime() > 0 && completedDate >= weekStart && completedDate <= weekEnd;
      }).length;
      
      const created = tasks.filter(t => {
        const createdDate = parseDateStr(t['Ngày Tạo']);
        return createdDate.getTime() > 0 && createdDate >= weekStart && createdDate <= weekEnd;
      }).length;
      
      weeklyTrend.push({
        label: (weekStart.getDate()) + '/' + (weekStart.getMonth() + 1) + ' - ' + (weekEnd.getDate()) + '/' + (weekEnd.getMonth() + 1),
        completed,
        created
      });
    }
    
    return JSON.stringify({
      success: true,
      data: {
        companyName: settings['Tên công ty'] || 'Quản Lý Dự Án',
        projectStats,
        taskStats,
        memberStats,
        priorityStats,
        overdueTasks: overdueTasks.length,
        overdueTasksList: overdueTasks.slice(0, 10),
        totalBudget,
        totalActualCost,
        memberTaskStats,
        projectProgress,
        recentActivities,
        upcomingTasks: upcomingTasks.slice(0, 10),
        weeklyTrend
      }
    });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}
