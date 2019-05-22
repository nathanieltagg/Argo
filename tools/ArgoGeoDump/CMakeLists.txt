include_directories( ${CMAKE_CURRENT_SOURCE_DIR} )
include_directories( $ENV{NUTOOLS_INC} )

# Use the current directory name to set the name of the library.
get_filename_component( THISLIB  ${CMAKE_CURRENT_SOURCE_DIR} NAME )


art_make( BASENAME_ONLY
          LIBRARY_NAME  ${THISLIB}
          MODULE_LIBRARIES  
                            # ${THISLIB}  ${THISLIB}_dict
                            larcore_Geometry_Geometry_service
                            larcorealg_Geometry
                            lardataobj_RecoBase
                            # nusimdata_SimulationBase
                            lardata_ArtDataHelper # HitCreator
                            ${SIMULATIONBASE}
                            ${LARRECO_LIB}
                            ${LARDATA_LIB}
                            ${ART_FRAMEWORK_CORE}
                            ${ART_FRAMEWORK_PRINCIPAL}
                            ${ART_FRAMEWORK_SERVICES_REGISTRY}
                            ${ART_FRAMEWORK_SERVICES_OPTIONAL}
                            ${ART_FRAMEWORK_SERVICES_OPTIONAL_TFILESERVICE_SERVICE}
                            ${ART_PERSISTENCY_COMMON}
                            ${ART_PERSISTENCY_PROVENANCE}
                            ${ART_UTILITIES}
                            ${MF_MESSAGELOGGER}
                            ${MF_UTILITIES}
                            ${CETLIB}
                            ${ROOT_PHYSICS}
                            ${ROOT_GEOM}
                            ${ROOT_XMLIO}
                            ${ROOT_GDML}
                            ${ROOT_BASIC_LIB_LIST}
                            ${ROOT_CORE}
                            ${ROOT_EG}
               
            LIB_LIBRARIES   ${ROOT_PHYSICS}
                            ${ROOT_GEOM}
                            ${ROOT_XMLIO}
                            ${ROOT_GDML}
                            ${ROOT_BASIC_LIB_LIST}
                            ${ROOT_CORE}
                            ${ROOT_EG}
            DICTIONARY_LIBRARIES  ${ROOT_PHYSICS}
                            ${ROOT_GEOM}
                            ${ROOT_XMLIO}
                            ${ROOT_GDML}
                            ${ROOT_BASIC_LIB_LIST}
                            ${ROOT_CORE}
                            ${ROOT_EG}
      )

      
install_fhicl()
install_source()
install_headers()
