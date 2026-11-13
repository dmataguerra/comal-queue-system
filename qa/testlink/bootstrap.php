<?php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$apiFile = '/var/www/html/lib/api/xmlrpc/v1/xmlrpc.class.php';
file_put_contents($apiFile, str_replace('(arrya)', '(array)', file_get_contents($apiFile)));
$db = new mysqli('db', 'testlink', getenv('TESTLINK_DB_PASSWORD'), 'testlink');
$db->set_charset('utf8');
function runSql($db, $sql) {
  $db->multi_query($sql);
  do { if ($r=$db->store_result()) $r->free(); } while ($db->more_results() && $db->next_result());
}
$exists = $db->query("SHOW TABLES LIKE 'db_version'")->num_rows > 0;
if (!$exists && $db->query("SHOW TABLES")->num_rows > 0) { throw new RuntimeException("Partial schema detected. Restore a backup or use a new empty database volume; no data were overwritten."); }
if ($exists && (int)$db->query("SELECT count(*) FROM db_version WHERE version='DB 1.9.20'")->fetch_row()[0] !== 1) { throw new RuntimeException("Unexpected schema version; migration required."); }
if (!$exists) {
  foreach (['testlink_create_tables.sql','testlink_create_default_data.sql'] as $file) {
    runSql($db, str_replace('/*prefix*/', '', file_get_contents('/var/www/html/install/sql/mysql/'.$file)));
  }
  runSql($db, "DROP FUNCTION IF EXISTS UDFStripHTMLTags");
  runSql($db, "CREATE FUNCTION UDFStripHTMLTags(Dirty TEXT) RETURNS TEXT CHARSET utf8 DETERMINISTIC BEGIN DECLARE iStart, iEnd, iLength int; WHILE Locate('<', Dirty)>0 AND Locate('>',Dirty,Locate('<',Dirty))>0 DO SET iStart=Locate('<',Dirty), iEnd=Locate('>',Dirty,Locate('<',Dirty)); SET iLength=(iEnd-iStart)+1; IF iLength>0 THEN SET Dirty=Insert(Dirty,iStart,iLength,''); END IF; END WHILE; RETURN Dirty; END");
}
preg_match_all('/CREATE TABLE\s+`?([a-zA-Z0-9_]+)/i', str_replace('/*prefix*/', '', file_get_contents('/var/www/html/install/sql/mysql/testlink_create_tables.sql')), $schemaTables);
foreach ($schemaTables[1] as $table) {
  if ($db->query("SHOW TABLES LIKE '".$db->real_escape_string($table)."'")->num_rows !== 1) throw new RuntimeException('Incomplete schema: missing '.$table);
}
if ((int)$db->query("SELECT count(*) FROM users WHERE login='admin'")->fetch_row()[0] !== 1) throw new RuntimeException('Incomplete initial data: administrator missing.');
$config = "<?php\n";
foreach (['DB_TYPE'=>'mysqli','DB_USER'=>'testlink','DB_PASS'=>getenv('TESTLINK_DB_PASSWORD'),'DB_HOST'=>'db','DB_NAME'=>'testlink','DB_TABLE_PREFIX'=>''] as $key=>$value) $config .= 'define('.var_export($key,true).', '.var_export($value,true).");\n";
file_put_contents('/var/www/html/config_db.inc.php', $config);
file_put_contents('/var/www/html/custom_config.inc.php', '<?php'."\n".'$tlCfg->api->enabled = TRUE;'."\n".'$tlCfg->config_check_warning_mode = "FILE";'."\n".'$g_mail_priority = 0;'."\n");
$password=password_hash(getenv('TESTLINK_ADMIN_PASSWORD'),PASSWORD_BCRYPT);
$key=getenv('TESTLINK_API_KEY');
$stmt=$db->prepare("UPDATE users SET password=?, script_key=?, locale='es_ES', email='qa@localhost.invalid' WHERE login='admin'");
$stmt->bind_param('ss',$password,$key); $stmt->execute();
foreach (['/var/testlink/logs','/var/testlink/upload_area','/var/www/html/gui/templates_c'] as $dir) { if (!is_dir($dir)) mkdir($dir,0770,true); chown($dir,'www-data'); chgrp($dir,'www-data'); }
foreach (['install', 'docs'] as $blocked) file_put_contents('/var/www/html/'.$blocked.'/.htaccess', "Require all denied\n");
echo $exists ? "Existing installation configured; no test data deleted.\n" : "Fresh TestLink schema installed.\n";



