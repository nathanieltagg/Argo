$title =  "Online Monitor File Browser";
$default_path = "/datalocal/om";
$cookie_name = 'lizard_file_browser';
$link_target = "../";
$restrict_to = [ getcwd(), "/home/tagg/data", "/" ];
$force_paths = [ "/home/tagg/data/om" ]; # Reads dir to ensure they exist; required for bluearc

1;
