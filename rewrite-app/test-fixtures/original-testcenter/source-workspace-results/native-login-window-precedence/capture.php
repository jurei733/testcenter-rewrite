<?php
declare(strict_types=1);
class SystemConfig {public static string $system_timezone='Europe/Berlin'; public static string $language_dateFormat='Y-m-d H:i:s'; public static string $debug_useStaticTime='2026-01-01 12:00:00';}
class DAO {public static array $row=[]; protected function _(string $sql,array $params=[]):array {if(!str_contains($sql,'logins.valid_from')||count($params)!==1)throw new RuntimeException('Unexpected read');return self::$row;}}
$root='/var/www/testcenter/backend';
$files=['src/exception/HttpError.class.php','src/data-collection/ExpirationStateType.enum.php','src/data-collection/ExpirationState.class.php','src/helper/TimeStamp.class.php','src/dao/SessionDAO.class.php','src/helper/Password.class.php'];$hashes=[];
foreach($files as $file){$hashes[$file]=hash_file('sha256',"$root/$file");require_once "$root/$file";}
$ownedHash=Password::encrypt('Owned correct password','t');if(!Password::verify('Owned correct password',$ownedHash,'t')||Password::verify('Owned wrong password',$ownedHash,'t'))throw new RuntimeException('Invalid owned hash');
$rows=[];
foreach(['expired'=>['valid_from'=>null,'valid_to'=>'2000-01-01 12:00:00+00:00'],'scheduled'=>['valid_from'=>'2099-01-01 12:00:00+00:00','valid_to'=>null]] as $state=>$window){
 foreach(['','Owned wrong password','Owned correct password'] as $password){
  DAO::$row=['name'=>'owned-window-actor','mode'=>'run-hot-return','group_name'=>'owned','group_label'=>'Owned','codes_to_booklets'=>'{}','workspace_id'=>1,'valid_for'=>null,'custom_texts'=>'{}','password'=>$ownedHash,'monitors'=>'[]','view_settings'=>'{}',...$window];
  try{(new SessionDAO())->getLogin('owned-window-actor',$password);throw new RuntimeException('Window unexpectedly admitted');}catch(HttpError $e){$rows[]=['state'=>$state,'passwordKind'=>$password===''?'empty':($password==='Owned wrong password'?'wrong':'correct'),'status'=>$e->getCode(),'message'=>$e->getMessage()];}
 }
}
echo json_encode(['scope'=>'Actual pinned Source SessionDAO.getLogin and TimeStamp code with an owned in-memory DAO row; no live DB/session writes; not full Source HTTP qualification','php'=>PHP_VERSION,'sourceHashes'=>$hashes,'clock'=>SystemConfig::$debug_useStaticTime,'rows'=>$rows],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES),"\n";
