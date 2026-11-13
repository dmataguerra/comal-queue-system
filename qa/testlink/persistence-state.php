<?php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$db=new mysqli('db','testlink',getenv('TESTLINK_DB_PASSWORD'),'testlink');
$state=[];
foreach(['db_version','testprojects','tcversions','executions','attachments'] as $table) {
  $state[$table]=(int)$db->query('SELECT count(*) FROM '.$table)->fetch_row()[0];
}
echo json_encode($state, JSON_PRETTY_PRINT)."\n";
