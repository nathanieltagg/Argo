#!/usr/bin/perl -w
use CGI::Pretty qw/:standard *table *tr start_Tr start_td start_ul start_tbody end_tbody *div/;
use CGI::Carp qw/warningsToBrowser fatalsToBrowser/;
  use POSIX qw(strftime);
#
# Script to browse ROOT files on the server. Mild security hassle as viewers on the web
#  can see directory structrures and ROOT files.
#

#default configuration
$title =  "Arachne File Browser";
$default_path = "/minerva/data";
$cookie_name = 'arachne_file_browser';
$link_target = "../arachne.html";

# Different configuration.
if( -r "file_browser_config.pl" ) {
    require "file_browser_config.pl" || die;
}  

sub get_filesize_str
{
    my $size = shift;
    if ($size > 1099511627776)  #   TiB: 1024 GiB
    {
        return sprintf("%.2f TB", $size / 1099511627776);
    }
    elsif ($size > 1073741824)  #   GiB: 1024 MiB
    {
        return sprintf("%.2f GB", $size / 1073741824);
    }
    elsif ($size > 1048576)       #   MiB: 1024 KiB
    {
        return sprintf("%.2f MB", $size / 1048576);
    }
    elsif ($size > 1024)            #   KiB: 1024 B
    {
        return sprintf("%.2f kB", $size / 1024);
    }
    else                                    #   bytes
    {
        return sprintf("%.2f bytes", $size);
    }
}
my $title = "Arachne File Browser";
if(! -d $default_path) { $default_path = `pwd`; chomp $default_path;}

$cur_path = $default_path;
$cook_path = cookie($cookie_name);
if(defined $cook_path) {
  # $cur_path = $cook_path;
}
if(defined param('path')) {$cur_path = param('path');};


$cookie = cookie(-name=>$cookie_name,
                 -value=>$cur_path,
                 -expires=>'+1y',
                 -path=>'/');

print header(-cookie=>$cookie);


$scripts = [
            { -type => 'text/javascript',
              -src      => 'https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js'
            },
            { -type => 'text/javascript',
              -src      => '../js/jquery.tablesorter.js'
            },
            { -type => 'text/javascript',
              -src      => 'file_browser.js'}              
              ];
$stylesheets= ['file_browser.css'];

print start_html(
     -title=>$title
     # CSS
       , -style=>{-src=>$stylesheets
                 ,-media=>'all'
                 }
     # javascript
       ,-script=>$scripts
       );

print h2({-id=>"title"},$title);


print start_div({id=>"cur_path"});
@breakdown = split('/',$cur_path);
shift @breakdown;
$bp = "";
foreach $parent (@breakdown)
{
  $bp .= "/" . $parent ;
  print a({-href=>url()."?path=$bp"},$parent) . "/";
}
print end_div;
print br. br;

# read directory.
if (! opendir(IMD, $cur_path) )
{ 
    print p("Cannot open directory $cur_path");
    print end_html; 
    exit(); 
};

@thefiles= readdir(IMD); 
closedir(IMD);

@thefiles = sort @thefiles;

@dirs= ();
@files=();
foreach $f (@thefiles)
{
  if ($f =~ /^\./) { next; }
  if( -d "$cur_path/$f" ) {push @dirs,$f;}
  if( $f =~ /\.root$/ ) {push @files,$f};
}

if( scalar(@files) ==0 ) {
  print p("No data files here.");
} else {

  print start_table({-class=>"filetable tablesorter"});
  print thead(Tr({-style=>"text-align:left;"},th("File"),th("Date"),th("Size")));
  print start_tbody;
  foreach $f (@files)
  {
    @info = stat("$cur_path/$f");
    print Tr(
             td( a({-href=>"$link_target?entry=0&filename=$cur_path/$f"},"$f"))
            ,td({-class=>"date"},strftime("%b %e, %Y %H:%M",localtime($info[9])))
            ,td({-class=>"size"},get_filesize_str($info[7]))
          
            );
  }
  print end_tbody;
  print end_table;
}

foreach $f (@dirs)
{
  print div({-class=>"subdir"}, a({-href=>url()."?path=$cur_path/$f"},"$f/") );
}

print end_html;
