<?php
require "/var/www/testcenter/backend/vendor/autoload.php";
$method=new ReflectionMethod("RequestHelper","extractFields");
$fields=["loginName"=>"REQUIRED","code"=>"","nameSuffix"=>"","bookletName"=>"REQUIRED"];
$cases=json_decode('[{"personSessions":[{"loginName":{},"bookletName":null}]},{"personSessions":[{"loginName":"unknown","code":{},"bookletName":"unknown"},{"loginName":"unknown"}]}]');
$out=[];
foreach($cases as $case){$count=0;try{foreach($case->personSessions as $row){$method->invoke(null,$row,$fields);$count++;}$out[]=["status"=>200,"extracted"=>$count];}catch(Throwable $error){$out[]=["class"=>get_class($error),"status"=>$error->getCode(),"message"=>$error->getMessage(),"extractedBeforeError"=>$count];}}
echo json_encode(["actualSourceMethod"=>$method->getFileName(),"PHP"=>PHP_VERSION,"inputs"=>$cases,"observations"=>$out],JSON_THROW_ON_ERROR);
