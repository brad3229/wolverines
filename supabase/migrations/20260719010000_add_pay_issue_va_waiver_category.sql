-- New pay_issues category: a Soldier receiving VA disability pay who wants to waive/decline
-- drill pay (common when concurrent receipt would affect their VA disability compensation).
alter type pay_issue_category add value 'va_disability_waiver';
