{% macro generate_schema_name(custom_schema_name, node) -%}

    {%- set default_schema = target.schema -%}
    
    {# Se nenhum schema customizado for definido, usa o padrão do profiles.yml #}
    {%- if custom_schema_name is none -%}
        {{ default_schema }}
        
    {# Se o schema customizado existir (ex: staging), usa apenas ele #}
    {%- else -%}
        {{ custom_schema_name | trim }}
        
    {%- endif -%}

{%- endmacro %}