#!/usr/bin/perl -w
use CGI::Pretty qw/:standard *table *tr start_Tr start_td start_ul start_tbody end_tbody *div/;
use CGI::Carp qw/warningsToBrowser fatalsToBrowser/;

$filename = param('file');
$filename=~s/\//___/g;

open (LOG,">>","read.log");
print LOG "Serving $filename\n";
#escape all slashes so user can't muck up my filesystem.
if(-r $filename) {
  my $length = (stat($filename)) [10];
  my $type = 'image/png';
  print CGI::header({type=>$type,
                     expires=>'+1m',
                     content_length=>$length});
  binmode STDOUT;
  open(FH,"<",$filename);
  my $buff = "";
  while(read(FH,$buff,20240)) { print $buff; }
  close(FH);
  unlink $filename;       
  print LOG "Deleted $filename\n";
}
